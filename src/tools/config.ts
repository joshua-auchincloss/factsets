import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	getConfig,
	setConfig,
	deleteConfig,
	getAllConfig,
} from "../db/operations/config.js";
import { resolveSkillsDir } from "../db/operations/skills.js";
import { skills } from "../db/schema.js";
import { z } from "zod";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, basename } from "node:path";
import { eq } from "drizzle-orm";
import { fileExists, readTextFile, writeTextFile } from "../utils/fs.js";

const getConfigInput = z.object({
	key: z.string().min(1),
});

const setConfigInput = z.object({
	key: z.string().min(1),
	value: z.string().min(1),
	migrate: z
		.boolean()
		.optional()
		.describe(
			"For skills_dir: migrate existing skills to the new directory and update DB paths",
		),
});

const deleteConfigInput = z.object({
	key: z.string().min(1),
});

async function migrateSkillsDir(
	db: DB,
	oldDir: string,
	newDir: string,
): Promise<{ moved: number; errors: string[] }> {
	const errors: string[] = [];
	let moved = 0;

	// Create new directory
	await mkdir(newDir, { recursive: true });

	// Get all skills from DB
	const allSkills = await db.select().from(skills);

	for (const skill of allSkills) {
		const oldPath = skill.filePath;
		const fileName = basename(oldPath);
		const newPath = join(newDir, fileName);

		try {
			// Check if old file exists and move it
			if (await fileExists(oldPath)) {
				const content = await readTextFile(oldPath);
				await writeTextFile(newPath, content);
				await rm(oldPath, { force: true });
			}

			// Update DB path regardless (in case file was already in new location or missing)
			await db
				.update(skills)
				.set({ filePath: newPath })
				.where(eq(skills.id, skill.id));

			moved++;
		} catch (err) {
			errors.push(
				`Failed to migrate ${skill.name}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// Try to clean up old directory if empty
	try {
		const remaining = await readdir(oldDir);
		if (remaining.length === 0) {
			await rm(oldDir, { recursive: true, force: true });
		}
	} catch {
		// Ignore cleanup errors
	}

	return { moved, errors };
}

export function registerConfigTools(server: McpServer, db: DB) {
	server.registerTool(
		"get_config",
		{
			description: "Get a configuration value by key",
			inputSchema: getConfigInput,
		},
		async ({ key }) => {
			const value = await getConfig(db, key);
			return {
				content: [{ type: "text", text: JSON.stringify({ key, value }) }],
			};
		},
	);

	server.registerTool(
		"set_config",
		{
			description:
				"Set a configuration value. Common keys: 'client' (github-copilot, cursor, windsurf, claude-desktop), 'skills_dir' (custom skills directory path). For skills_dir, set migrate=true to move existing skills.",
			inputSchema: setConfigInput,
		},
		async ({ key, value, migrate }) => {
			// Special handling for skills_dir with migration
			if (key === "skills_dir" && migrate) {
				const oldDir = await resolveSkillsDir(db);
				const newDir = value;

				if (oldDir !== newDir) {
					const result = await migrateSkillsDir(db, oldDir, newDir);

					// Set the new config value
					await setConfig(db, key, value);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									success: true,
									key,
									value,
									migration: {
										from: oldDir,
										to: newDir,
										moved: result.moved,
										errors: result.errors,
									},
								}),
							},
						],
					};
				}
			}

			await setConfig(db, key, value);
			return {
				content: [
					{ type: "text", text: JSON.stringify({ success: true, key, value }) },
				],
			};
		},
	);

	server.registerTool(
		"delete_config",
		{
			description: "Delete a configuration value by key",
			inputSchema: deleteConfigInput,
		},
		async ({ key }) => {
			await deleteConfig(db, key);
			return {
				content: [
					{ type: "text", text: JSON.stringify({ success: true, key }) },
				],
			};
		},
	);

	server.registerTool(
		"list_config",
		{
			description: "List all configuration values",
		},
		async () => {
			const config = await getAllConfig(db);
			return {
				content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
			};
		},
	);
}
