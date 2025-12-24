#!/usr/bin/env bun
/**
 * Pre-test script to hydrate dependencies before running tests.
 *
 * This script:
 * 1. Fetches all published versions of factsets from GitHub
 * 2. Writes them to versions.json for tests to read (no network calls during tests)
 * 3. Pre-installs all versions to cache them before test execution
 *
 * This helps prevent sporadic timeout issues in CI environments.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import semver from "semver";
import axios from "axios";
import { $ } from "bun";

/** Minimum version to include in pre-hydration (matches migration tests) */
const MIN_TEST_VERSION = "0.1.0";

/** GitHub API URL for factsets tags */
const GITHUB_API_URL =
	"https://api.github.com/repos/joshua-auchincloss/factsets";

/** Output file for versions manifest */
const VERSIONS_FILE = join(import.meta.dir, "..", "versions.json");

const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;

/** Optional GitHub token for authenticated API requests (higher rate limits) */
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * Check if we're running in the release workflow (triggered by tag push).
 * The release workflow is the only one that runs on refs/tags/*.
 */
function isReleaseWorkflow(): boolean {
	const githubRef = process.env.GITHUB_REF;
	return !!githubRef && githubRef.startsWith("refs/tags/");
}

/**
 * Check if a version exists on npm registry.
 * Returns true if the version is published, false otherwise.
 */
async function checkNpmVersionExists(version: string): Promise<boolean> {
	try {
		const response = await axios.get(
			`https://registry.npmjs.org/factsets/${version}`,
			{
				timeout: 10000,
				validateStatus: (status) => status === 200 || status === 404,
			},
		);
		return response.status === 200;
	} catch (error) {
		console.warn(
			`[pre-test] Failed to check npm for version ${version}:`,
			error instanceof Error ? error.message : String(error),
		);
		// If we can't check, assume it exists to avoid breaking tests
		return true;
	}
}

/**
 * Build headers for GitHub API requests.
 * Includes authentication if GITHUB_TOKEN is available.
 */
function getGitHubHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "factsets-pre-test",
	};

	if (GITHUB_TOKEN) {
		headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
	}

	return headers;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(error: unknown): number {
	if (!axios.isAxiosError(error)) return DEFAULT_RETRY_DELAY_MS;

	const headers = error.response?.headers;
	if (!headers) return DEFAULT_RETRY_DELAY_MS;

	const retryAfter = headers["retry-after"];
	if (retryAfter) {
		const seconds = Number.parseInt(retryAfter, 10);
		if (!Number.isNaN(seconds)) {
			return seconds * 1000;
		}
	}

	const resetTimestamp = headers["x-ratelimit-reset"];
	if (resetTimestamp) {
		const resetTime = Number.parseInt(resetTimestamp, 10) * 1000;
		const waitTime = resetTime - Date.now();
		if (waitTime > 0) {
			return Math.min(waitTime, 60000);
		}
	}

	return DEFAULT_RETRY_DELAY_MS;
}

async function fetchWithRetry<T>(url: string): Promise<T> {
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const response = await axios.get<T>(url, {
				headers: getGitHubHeaders(),
				timeout: 60000,
			});

			if (response.status === 200) {
				return response.data;
			}

			throw new Error(
				`GitHub API returned unexpected status ${response.status}`,
			);
		} catch (error) {
			const status = axios.isAxiosError(error) ? error.response?.status : null;
			const isRateLimit = status === 403 || status === 429;

			if (status && status >= 400 && status < 500 && !isRateLimit) {
				throw new Error(`GitHub API client error: ${status}`);
			}

			if (attempt < MAX_RETRIES - 1) {
				const delayMs = getRetryDelayMs(error);
				console.warn(
					`GitHub API ${isRateLimit ? "rate limited" : "error"}, waiting ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`,
				);
				await sleep(delayMs);
			} else {
				throw error;
			}
		}
	}

	throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
}

async function getPublishedVersions(): Promise<string[]> {
	console.log("[pre-test] Fetching published versions from GitHub...");
	if (GITHUB_TOKEN) {
		console.log("[pre-test] Using authenticated GitHub API requests");
	} else {
		console.log(
			"[pre-test] Using unauthenticated GitHub API (set GITHUB_TOKEN for higher rate limits)",
		);
	}

	const data = await fetchWithRetry<Array<{ name: string }>>(
		`${GITHUB_API_URL}/tags`,
	);

	const versions = data
		.map((t) => t.name)
		.filter((tag) => {
			if (!/^v\d+\.\d+\.\d+/.test(tag)) return false;
			const version = tag.replace(/^v/, "");
			return semver.gte(version, MIN_TEST_VERSION);
		})
		.map((tag) => tag.replace(/^v/, ""))
		.sort((a, b) => semver.compare(a, b));

	return versions;
}

interface VersionsManifest {
	generatedAt: string;
	minVersion: string;
	versions: string[];
	tags: string[];
}

async function writeVersionsManifest(versions: string[]): Promise<void> {
	const manifest: VersionsManifest = {
		generatedAt: new Date().toISOString(),
		minVersion: MIN_TEST_VERSION,
		versions,
		tags: versions.map((v) => `v${v}`),
	};

	await writeFile(VERSIONS_FILE, JSON.stringify(manifest, null, "\t") + "\n");
	console.log(`[pre-test] Wrote versions manifest to ${VERSIONS_FILE}`);
}

async function preInstallVersion(version: string): Promise<void> {
	console.log(`[pre-test] Pre-installing factsets@${version}...`);

	const result = await $`bunx factsets@${version} --help`.quiet().nothrow();

	if (result.exitCode !== 0) {
		throw new Error(
			`Failed to pre-install factsets@${version}: exit code ${result.exitCode}`,
		);
	}

	console.log(`[pre-test] Cached factsets@${version}`);
}

async function main(): Promise<void> {
	console.log("[pre-test] Starting dependency pre-hydration...");
	console.log(`[pre-test] Minimum version: ${MIN_TEST_VERSION}`);

	const inReleaseWorkflow = isReleaseWorkflow();
	if (inReleaseWorkflow) {
		console.log(
			"[pre-test] Running in release workflow (refs/tags) - will check npm availability",
		);
	}

	const versions = await getPublishedVersions();

	if (versions.length === 0) {
		throw new Error("No published versions found - cannot proceed");
	}

	// Check if the latest version is published to npm yet
	// During release: tag exists but package not published until tests pass
	let versionsToInstall = versions;
	const latestVersion = versions[versions.length - 1];

	if (latestVersion) {
		const exists = await checkNpmVersionExists(latestVersion);
		if (!exists) {
			console.warn(
				`[pre-test] Latest version ${latestVersion} not yet published to npm - skipping pre-install`,
			);
			if (inReleaseWorkflow) {
				console.log(
					"[pre-test] This is expected during release workflow (package publishes after tests pass)",
				);
			}
			versionsToInstall = versions.slice(0, -1);
		}
	}

	// Write manifest with ALL versions (including unpublished) so tests know about them
	await writeVersionsManifest(versions);

	if (versionsToInstall.length === 0) {
		console.log(
			"[pre-test] No versions available for pre-install (skipping hydration)",
		);
		return;
	}

	console.log(
		`[pre-test] Found ${versionsToInstall.length} versions to pre-install:`,
	);
	console.log(`[pre-test] Versions: ${versionsToInstall.join(", ")}`);

	// Pre-install versions sequentially to fail fast on errors
	for (const version of versionsToInstall) {
		await preInstallVersion(version);
	}

	console.log(
		`[pre-test] Pre-hydration complete: ${versionsToInstall.length} versions cached`,
	);
}

main().catch((error) => {
	console.error("[pre-test] Fatal error:", error);
	process.exit(1);
});
