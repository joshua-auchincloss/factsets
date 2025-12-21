#!/usr/bin/env bun
/**
 * Version update script for Factsets
 * Updates version references in package.json and server.json
 *
 * Usage: bun scripts/version.ts <version>
 * Example: bun scripts/version.ts 0.2.0
 * Example: bun scripts/version.ts v0.2.0  (v prefix is stripped)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

function normalizeVersion(input: string): string {
	// Strip 'v' prefix if present
	return input.startsWith("v") ? input.slice(1) : input;
}

function validateVersion(version: string): boolean {
	// Basic semver validation: major.minor.patch with optional prerelease
	const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
	return semverRegex.test(version);
}

function updateJsonFile(
	filePath: string,
	version: string,
	replacer: (content: string, version: string) => string,
): void {
	const fullPath = join(ROOT, filePath);
	const content = readFileSync(fullPath, "utf-8");
	const updated = replacer(content, version);

	if (content === updated) {
		console.log(`${filePath}: No changes needed`);
		return;
	}

	writeFileSync(fullPath, updated);
	console.log(`${filePath}: Updated to ${version}`);
}

function updatePackageJson(content: string, version: string): string {
	// Replace the version field in package.json
	return content.replace(/"version":\s*"[^"]+"/, `"version": "${version}"`);
}

function updateServerJson(content: string, version: string): string {
	// Replace all version fields in server.json
	// There are two: root level and inside packages array
	return content.replace(/"version":\s*"[^"]+"/g, `"version": "${version}"`);
}

function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error("Usage: bun scripts/version.ts <version>");
		console.error("Example: bun scripts/version.ts 0.2.0");
		process.exit(1);
	}

	const rawVersion = args[0];
	const version = normalizeVersion(rawVersion);

	if (!validateVersion(version)) {
		console.error(`Invalid version format: ${rawVersion}`);
		console.error("Expected semver format: major.minor.patch (e.g., 0.2.0)");
		process.exit(1);
	}

	console.log(`\nUpdating version to ${version}...\n`);

	try {
		updateJsonFile("package.json", version, updatePackageJson);
		updateJsonFile("server.json", version, updateServerJson);
		console.log("\nVersion update complete!\n");
	} catch (error) {
		console.error("\nVersion update failed:", error);
		process.exit(1);
	}
}

main();
