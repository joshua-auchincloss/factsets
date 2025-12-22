import { execSync } from "node:child_process";
import { unlink, access, stat } from "node:fs/promises";
import semver from "semver";
import packageJson from "../../package.json" with { type: "json" };

export const CURRENT_VERSION = packageJson.version;

/** Minimum version to include in migration tests */
export const MIN_TEST_VERSION = "0.1.0";

export interface VersionInfo {
	version: string;
	tag: string;
	isPublished: boolean;
	isDevelopment: boolean;
}

/**
 * Get all release tags from the git repository, sorted by semantic version.
 * Returns tags in ascending order (oldest first).
 * Filters out versions below MIN_TEST_VERSION.
 */
export function getReleaseTags(): string[] {
	try {
		const output = execSync("git tag --list 'v*' --sort=version:refname", {
			encoding: "utf-8",
			cwd: process.cwd(),
		});
		return output
			.split("\n")
			.map((tag) => tag.trim())
			.filter((tag) => {
				if (!tag.length || !/^v\d+\.\d+\.\d+/.test(tag)) return false;
				const version = tag.replace(/^v/, "");
				return semver.gte(version, MIN_TEST_VERSION);
			});
	} catch (error) {
		console.warn("Failed to get git tags:", error);
		return [];
	}
}

/**
 * Get all published npm versions, sorted by semantic version.
 * Filters out versions below MIN_TEST_VERSION.
 */
export async function getPublishedVersions(): Promise<string[]> {
	try {
		const output = execSync("npm view factsets versions --json 2>/dev/null", {
			encoding: "utf-8",
		});
		const versions = JSON.parse(output) as string[];
		return sortVersions(versions).filter((v) =>
			semver.gte(v, MIN_TEST_VERSION),
		);
	} catch {
		// Fall back to git tags
		return getReleaseTags().map((tag) => tag.replace(/^v/, ""));
	}
}

/**
 * Sort versions by semantic version (ascending)
 */
export function sortVersions(versions: string[]): string[] {
	return [...versions].sort((a, b) => semver.compare(a, b));
}

/**
 * Compare two versions using semver
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
	return semver.compare(a, b);
}

/**
 * Convert version to tag format (e.g., "0.1.0" -> "v0.1.0")
 */
export function versionToTag(version: string): string {
	return version.startsWith("v") ? version : `v${version}`;
}

/**
 * Convert tag to version format (e.g., "v0.1.0" -> "0.1.0")
 */
export function tagToVersion(tag: string): string {
	return tag.replace(/^v/, "");
}

/**
 * Check if a version exists on npm (can be installed via bunx)
 */
export async function isVersionPublished(version: string): Promise<boolean> {
	try {
		execSync(`npm view factsets@${version} version 2>/dev/null`, {
			encoding: "utf-8",
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Get full version information including publication status
 */
export async function getVersionInfo(version: string): Promise<VersionInfo> {
	const normalizedVersion = version.replace(/^v/, "");
	return {
		version: normalizedVersion,
		tag: versionToTag(normalizedVersion),
		isPublished: await isVersionPublished(normalizedVersion),
		isDevelopment: normalizedVersion === CURRENT_VERSION,
	};
}

/**
 * Get all versions with their info
 */
export async function getAllVersionsInfo(): Promise<VersionInfo[]> {
	const tags = getReleaseTags();
	const versions = tags.map((tag) => tagToVersion(tag));

	// Add current version if not in tags
	if (!versions.includes(CURRENT_VERSION)) {
		versions.push(CURRENT_VERSION);
	}

	const sorted = sortVersions(versions);
	const infos: VersionInfo[] = [];

	for (const version of sorted) {
		infos.push(await getVersionInfo(version));
	}

	return infos;
}

/**
 * Database file utilities for migration testing
 */
export class MigrationTestDb {
	constructor(public readonly path: string) {}

	/**
	 * Clean up the test database file and associated files
	 */
	async cleanup(): Promise<void> {
		const files = [this.path, `${this.path}-wal`, `${this.path}-shm`];

		for (const file of files) {
			try {
				await access(file);
				await unlink(file);
			} catch {
				// File doesn't exist
			}
		}
	}

	/**
	 * Check if the database exists and has data
	 */
	async exists(): Promise<boolean> {
		try {
			const stats = await stat(this.path);
			return stats.size > 0;
		} catch {
			return false;
		}
	}

	/**
	 * Get the database connection URL for use with factsets
	 */
	get connectionUrl(): string {
		return `sqlite://${this.path}`;
	}
}

/**
 * Create command args for running a specific version of factsets
 */
export function createVersionArgs(
	version: string,
	dbPath: string,
	options: { watchSkills?: boolean } = {},
): { command: string; args: string[] } {
	const normalizedVersion = version.replace(/^v/, "");
	const isDevelopment = normalizedVersion === CURRENT_VERSION;

	const baseArgs = ["mcp-server", "--database-url", `sqlite://${dbPath}`];

	if (!options.watchSkills) {
		baseArgs.push("--no-watch-skills");
	}

	if (isDevelopment) {
		return {
			command: "bun",
			args: ["src/main.ts", ...baseArgs],
		};
	}

	return {
		command: "bunx",
		args: [`factsets@${normalizedVersion}`, ...baseArgs],
	};
}
