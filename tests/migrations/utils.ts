import { unlink, access, stat } from "node:fs/promises";
import semver from "semver";
import packageJson from "../../package.json" with { type: "json" };
import axios from "axios";
export const IS_WINDOWS = process.platform === "win32";

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;

/**
 * Get retry delay from rate limit headers (in ms), or default
 */
function getRetryDelayMs(error: unknown): number {
	if (!axios.isAxiosError(error)) return DEFAULT_RETRY_DELAY_MS;

	const headers = error.response?.headers;
	if (!headers) return DEFAULT_RETRY_DELAY_MS;

	// Check Retry-After header
	const retryAfter = headers["retry-after"];
	if (retryAfter) {
		const seconds = Number.parseInt(retryAfter, 10);
		if (!Number.isNaN(seconds)) {
			return seconds * 1000;
		}
	}

	// Check GitHub's x-ratelimit-reset header (Unix timestamp)
	const resetTimestamp = headers["x-ratelimit-reset"];
	if (resetTimestamp) {
		const resetTime = Number.parseInt(resetTimestamp, 10) * 1000;
		const waitTime = resetTime - Date.now();
		if (waitTime > 0) {
			return Math.min(waitTime, 60000); // Cap at 60s
		}
	}

	return DEFAULT_RETRY_DELAY_MS;
}

/**
 * Fetch with retry for rate limits
 */
async function fetchWithRetry<T>(url: string): Promise<T | null> {
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const response = await axios.get<T>(url, {
				headers: {
					Accept: "application/vnd.github.v3+json",
					"User-Agent": "factsets-migration-tests",
				},
				timeout: 30000,
			});

			if (response.status === 200) {
				return response.data;
			}

			console.warn(`GitHub API returned ${response.status}`);
			return null;
		} catch (error) {
			const status = axios.isAxiosError(error) ? error.response?.status : null;
			const isRateLimit = status === 403 || status === 429;

			// Don't retry client errors (except rate limits)
			if (status && status >= 400 && status < 500 && !isRateLimit) {
				console.warn(`GitHub API error ${status}`);
				return null;
			}

			if (attempt < MAX_RETRIES - 1) {
				const delayMs = getRetryDelayMs(error);
				console.warn(
					`GitHub API ${isRateLimit ? "rate limited" : "error"}, waiting ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`,
				);
				await sleep(delayMs);
			}
		}
	}

	console.error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
	return null;
}

/**
 * Try to delete a file with retries for Windows file locking issues
 */
export async function unlinkWithRetry(
	filePath: string,
	maxRetries = 5,
	delayMs = 200,
): Promise<boolean> {
	for (let i = 0; i < maxRetries; i++) {
		try {
			await access(filePath);
			await unlink(filePath);
			return true;
		} catch (error: unknown) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") {
				return true; // File doesn't exist, success
			}
			if (
				err.code === "EBUSY" ||
				err.code === "EPERM" ||
				err.code === "EACCES"
			) {
				// File is locked, wait and retry
				if (i < maxRetries - 1) {
					await sleep(delayMs * (i + 1)); // Exponential backoff
					continue;
				}
			}
			// Other error or max retries reached
			return false;
		}
	}
	return false;
}

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
 * GitHub API base URL for factsets releases
 */
const GITHUB_API_URL =
	"https://api.github.com/repos/joshua-auchincloss/factsets";

const TAGS: string[] = [];

/**
 * Fetch release tags from GitHub API.
 * Returns tags in ascending order (oldest first).
 * Filters out versions below MIN_TEST_VERSION.
 */
export async function getReleaseTags(): Promise<string[]> {
	if (TAGS.length > 0) {
		return TAGS;
	}

	const data = await fetchWithRetry<Array<{ name: string }>>(
		`${GITHUB_API_URL}/tags`,
	);

	if (!data) {
		console.warn("Failed to fetch tags from GitHub API after all retries");
		return [];
	}

	const versionTags = data
		.map((t) => t.name)
		.filter((tag) => {
			if (!/^v\d+\.\d+\.\d+/.test(tag)) return false;
			const version = tag.replace(/^v/, "");
			return semver.gte(version, MIN_TEST_VERSION);
		});

	// Sort by semver ascending (oldest first)
	TAGS.push(
		...versionTags.sort((a, b) =>
			semver.compare(a.replace(/^v/, ""), b.replace(/^v/, "")),
		),
	);
	return TAGS;
}

/**
 * Get all published versions from GitHub tags, sorted by semantic version.
 * CI enforces that all tags have corresponding releases on GitHub and npm.
 * Filters out versions below MIN_TEST_VERSION.
 */
export async function getPublishedVersions(): Promise<string[]> {
	const tags = await getReleaseTags();
	return tags.map((tag) => tag.replace(/^v/, ""));
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
 * Check if a version exists as a GitHub tag.
 * CI enforces that all tags have corresponding releases.
 */
export async function isVersionPublished(version: string): Promise<boolean> {
	const tags = await getReleaseTags();
	const tag = versionToTag(version);
	return tags.includes(tag);
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
	const tags = await getReleaseTags();
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
	 * Clean up the test database file and associated files.
	 * Uses retry logic on Windows to handle file locking issues.
	 */
	async cleanup(): Promise<void> {
		const files = [this.path, `${this.path}-wal`, `${this.path}-shm`];

		// On Windows, add initial delay to allow process cleanup
		if (IS_WINDOWS) {
			await sleep(500);
		}

		for (const file of files) {
			if (IS_WINDOWS) {
				// Use retry logic on Windows due to file locking
				await unlinkWithRetry(file, 10, 300);
			} else {
				try {
					await access(file);
					await unlink(file);
				} catch {
					// File doesn't exist
				}
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
			command: "./node_modules/.bin/bun",
			args: ["src/main.ts", ...baseArgs],
		};
	}

	return {
		command: "./node_modules/.bin/bunx",
		args: [`factsets@${normalizedVersion}`, ...baseArgs],
	};
}
