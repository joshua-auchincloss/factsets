import { watch, type FSWatcher } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import type { CommandHandler } from "./types.js";
import { createConnection, runMigrations, type DB } from "../db/index.js";
import { skills } from "../db/schema.js";
import {
	syncSkill,
	resolveSkillsDir,
	registerSkillFromFile,
	deleteSkills,
} from "../db/operations/skills.js";
import { fileExists, toAbsolutePath } from "../utils/fs.js";

type Handler = CommandHandler<"watch-files">;

// Track active watchers by skill name
const watchers = new Map<string, FSWatcher>();

// Directory watcher
let directoryWatcher: FSWatcher | null = null;
let currentSkillsDir: string | null = null;

// Debounce map to prevent rapid re-syncs
const debounceTimers = new Map<string, Timer>();
const DEBOUNCE_MS = 100;

async function syncSkillDebounced(db: DB, skillName: string): Promise<void> {
	// Clear existing timer for this skill
	const existingTimer = debounceTimers.get(skillName);
	if (existingTimer) {
		clearTimeout(existingTimer);
	}

	// Set new debounced timer
	debounceTimers.set(
		skillName,
		setTimeout(async () => {
			debounceTimers.delete(skillName);
			try {
				const result = await syncSkill(db, { name: skillName });
				if (result.updated) {
					console.log(`[watch] Synced skill: ${skillName}`);
				}
			} catch (err) {
				console.error(
					`[watch] Error syncing ${skillName}:`,
					err instanceof Error ? err.message : err,
				);
			}
		}, DEBOUNCE_MS),
	);
}

async function watchSkillFile(
	db: DB,
	skillName: string,
	filePath: string,
): Promise<void> {
	// Don't watch if already watching
	if (watchers.has(skillName)) {
		return;
	}

	// Check file exists before watching (fileExists handles path conversion)
	if (!(await fileExists(filePath))) {
		console.warn(`[watch] Skill file not found: ${filePath}`);
		return;
	}

	// Use absolute path for fs.watch
	const absolutePath = toAbsolutePath(filePath);

	try {
		const watcher = watch(absolutePath, (eventType) => {
			if (eventType === "change") {
				syncSkillDebounced(db, skillName);
			}
		});

		watcher.on("error", (err) => {
			console.error(`[watch] Watcher error for ${skillName}:`, err.message);
			unwatchSkillFile(skillName);
		});

		watchers.set(skillName, watcher);
		console.log(`[watch] Watching: ${skillName} (${filePath})`);
	} catch (err) {
		console.error(
			`[watch] Failed to watch ${skillName}:`,
			err instanceof Error ? err.message : err,
		);
	}
}

function unwatchSkillFile(skillName: string): void {
	const watcher = watchers.get(skillName);
	if (watcher) {
		watcher.close();
		watchers.delete(skillName);
		console.log(`[watch] Stopped watching: ${skillName}`);
	}
}

async function refreshWatchers(db: DB): Promise<void> {
	// Get all current skills from DB
	const allSkills = await db.select().from(skills);
	const currentSkillNames = new Set(allSkills.map((s) => s.name));

	// Remove watchers for deleted skills
	for (const [skillName] of watchers) {
		if (!currentSkillNames.has(skillName)) {
			unwatchSkillFile(skillName);
		}
	}

	// Add watchers for new skills
	for (const skill of allSkills) {
		if (!watchers.has(skill.name)) {
			await watchSkillFile(db, skill.name, skill.filePath);
		}
	}
}

/**
 * Scan the skills directory for new .md files not yet registered
 */
async function scanForNewSkills(db: DB): Promise<void> {
	const skillsDir = await resolveSkillsDir(db);
	const absoluteSkillsDir = toAbsolutePath(skillsDir);

	try {
		const files = await readdir(absoluteSkillsDir);
		const mdFiles = files.filter((f) => f.endsWith(".md"));

		for (const file of mdFiles) {
			// Use relative path for storage, absolute for stat check
			const relativeFilePath = join(skillsDir, file);
			const absoluteFilePath = toAbsolutePath(relativeFilePath);
			const fileStat = await stat(absoluteFilePath).catch(() => null);

			// Only process regular files
			if (!fileStat?.isFile()) continue;

			// registerSkillFromFile will normalize to relative path
			const result = await registerSkillFromFile(db, relativeFilePath);
			if (result?.isNew) {
				console.log(
					`[watch] Auto-registered skill: ${result.name} (needs review)`,
				);
				await watchSkillFile(db, result.name, relativeFilePath);
			}
		}
	} catch (err) {
		// Directory may not exist yet
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			console.error("[watch] Error scanning skills directory:", err);
		}
	}
}

/**
 * Handle deleted skill files - remove from DB
 */
async function handleDeletedSkills(db: DB): Promise<void> {
	const allSkills = await db.select().from(skills);

	for (const skill of allSkills) {
		if (!(await fileExists(skill.filePath))) {
			console.log(`[watch] Skill file deleted: ${skill.name}`);
			unwatchSkillFile(skill.name);
			await deleteSkills(db, { names: [skill.name], deleteFiles: false });
		}
	}
}

/**
 * Watch the skills directory for new files
 */
async function watchSkillsDirectory(db: DB): Promise<void> {
	const skillsDir = await resolveSkillsDir(db);
	const absoluteSkillsDir = toAbsolutePath(skillsDir);

	// Close existing directory watcher if skills dir changed
	if (directoryWatcher && currentSkillsDir !== skillsDir) {
		directoryWatcher.close();
		directoryWatcher = null;
		console.log(
			`[watch] Skills directory changed: ${currentSkillsDir} -> ${skillsDir}`,
		);
	}

	if (directoryWatcher) return; // Already watching

	currentSkillsDir = skillsDir;

	try {
		// Ensure directory exists before watching
		const { mkdir } = await import("node:fs/promises");
		await mkdir(absoluteSkillsDir, { recursive: true });

		directoryWatcher = watch(absoluteSkillsDir, async (eventType, filename) => {
			if (!filename?.endsWith(".md")) return;

			// Use relative path for storage
			const relativeFilePath = join(skillsDir, filename);

			if (eventType === "rename") {
				// File added or removed - debounce and check
				const timerKey = `dir:${filename}`;
				const existingTimer = debounceTimers.get(timerKey);
				if (existingTimer) clearTimeout(existingTimer);

				debounceTimers.set(
					timerKey,
					setTimeout(async () => {
						debounceTimers.delete(timerKey);
						if (await fileExists(relativeFilePath)) {
							// File was added
							const result = await registerSkillFromFile(db, relativeFilePath);
							if (result?.isNew) {
								console.log(
									`[watch] Auto-registered skill: ${result.name} (needs review)`,
								);
								await watchSkillFile(db, result.name, relativeFilePath);
							}
						} else {
							// File was deleted
							const skillName = basename(filename, ".md");
							if (watchers.has(skillName)) {
								console.log(`[watch] Skill file deleted: ${skillName}`);
								unwatchSkillFile(skillName);
								await deleteSkills(db, {
									names: [skillName],
									deleteFiles: false,
								});
							}
						}
					}, DEBOUNCE_MS),
				);
			}
		});

		directoryWatcher.on("error", (err) => {
			console.error("[watch] Directory watcher error:", err.message);
			directoryWatcher = null;
		});

		console.log(`[watch] Watching skills directory: ${skillsDir}`);
	} catch (err) {
		console.error(
			"[watch] Failed to watch skills directory:",
			err instanceof Error ? err.message : err,
		);
	}
}

/**
 * Check if skills directory has changed and handle migration
 */
async function checkSkillsDirChange(db: DB): Promise<boolean> {
	const newSkillsDir = await resolveSkillsDir(db);

	if (currentSkillsDir && currentSkillsDir !== newSkillsDir) {
		console.log(
			`[watch] Skills directory changed: ${currentSkillsDir} -> ${newSkillsDir}`,
		);

		// Close directory watcher
		if (directoryWatcher) {
			directoryWatcher.close();
			directoryWatcher = null;
		}

		// Close all skill file watchers
		for (const [skillName] of watchers) {
			unwatchSkillFile(skillName);
		}

		currentSkillsDir = newSkillsDir;
		return true;
	}

	return false;
}

export const watchFilesHandler: Handler = async (config) => {
	const db = createConnection(config.databaseUrl);
	await runMigrations(db);

	console.log("[watch] Starting file watcher...");

	// Initialize skills directory
	currentSkillsDir = await resolveSkillsDir(db);

	// Scan for any existing files not yet registered
	await scanForNewSkills(db);

	// Handle any deleted skill files
	await handleDeletedSkills(db);

	// Initial setup of all watchers
	await refreshWatchers(db);

	// Watch the skills directory for new files
	await watchSkillsDirectory(db);

	// Periodically check for new/deleted skills and directory changes
	const pollInterval = Number.parseInt(config.pollInterval, 10) || 5000;
	const refreshInterval = setInterval(async () => {
		try {
			// Check if skills directory changed
			const dirChanged = await checkSkillsDirChange(db);

			if (dirChanged) {
				// Re-scan and re-setup watchers
				await scanForNewSkills(db);
				await refreshWatchers(db);
				await watchSkillsDirectory(db);
			} else {
				// Normal refresh
				await scanForNewSkills(db);
				await handleDeletedSkills(db);
				await refreshWatchers(db);
			}
		} catch (err) {
			console.error("[watch] Error in refresh cycle:", err);
		}
	}, pollInterval);

	// Handle graceful shutdown
	const shutdown = () => {
		console.log("\n[watch] Shutting down...");
		clearInterval(refreshInterval);

		if (directoryWatcher) {
			directoryWatcher.close();
			directoryWatcher = null;
		}

		for (const [skillName] of watchers) {
			unwatchSkillFile(skillName);
		}
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// Keep process alive
	console.log("[watch] File watcher running. Press Ctrl+C to stop.");
	await new Promise(() => {}); // Block forever
};
