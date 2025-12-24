import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
} from "bun:test";
import { createTestServer, type TestServer } from "../harness";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
	CURRENT_VERSION,
	MIN_TEST_VERSION,
	getReleaseTags,
	getPublishedVersions,
	isVersionPublished,
	MigrationTestDb,
	createVersionArgs,
	IS_WINDOWS,
	sleep,
} from "./utils";

const testDb = new MigrationTestDb("./.migrations-test.db");

/**
 * Safely close an MCP server with Windows-compatible cleanup
 */
async function closeServer(server: TestServer | null): Promise<void> {
	if (!server) return;
	try {
		await server.client.close();
	} catch {
		// Ignore close errors
	}
	// On Windows, add delay to allow process to fully terminate and release file handles
	if (IS_WINDOWS) {
		await sleep(1000);
	}
}

const extractText = <R extends Partial<CallToolResult>>(result: R): string => {
	const textContent = result.content?.find((c) => c.type === "text");
	return textContent?.type === "text" ? textContent.text : "";
};

const parseResult = <T>(result: Partial<CallToolResult>): T => {
	const text = extractText(result);
	return JSON.parse(text) as T;
};

describe("incremental migrations", () => {
	let publishedVersions: string[] = [];

	beforeAll(async () => {
		publishedVersions = await getPublishedVersions();
		console.log("Minimum test version:", MIN_TEST_VERSION);
		console.log("Published versions (filtered):", publishedVersions);
		console.log("Current development version:", CURRENT_VERSION);
	});

	afterAll(async () => {
		await testDb.cleanup();
	});

	describe("release tag discovery", () => {
		it("should have release tags from versions.json", async () => {
			const tags = await getReleaseTags();
			expect(Array.isArray(tags)).toBe(true);
			expect(tags.length).toBeGreaterThan(0);
			// All tags should have v prefix
			for (const tag of tags) {
				expect(tag.startsWith("v")).toBe(true);
			}
		});

		it("should have published versions available", async () => {
			expect(publishedVersions.length).toBeGreaterThan(0);
			// All versions should be valid semver format (no v prefix)
			for (const version of publishedVersions) {
				expect(version).toMatch(/^\d+\.\d+\.\d+/);
			}
		});
	});

	describe("sequential version migrations", () => {
		beforeEach(async () => {
			await testDb.cleanup();
		});

		it("should run migrations through all published versions sequentially", async () => {
			// Skip if no published versions
			if (publishedVersions.length === 0) {
				console.log("No published versions found, skipping sequential test");
				return;
			}

			// Filter to versions that are actually published on npm
			const availableVersions: string[] = [];
			for (const version of publishedVersions) {
				if (await isVersionPublished(version)) {
					availableVersions.push(version);
				}
			}

			if (availableVersions.length === 0) {
				console.log("No published versions available on npm, skipping");
				return;
			}

			console.log("Running migrations through versions:", availableVersions);

			// Run each version's migrations in order
			for (const version of availableVersions) {
				console.log(`\n--- Running migrations for version ${version} ---`);

				const { command, args } = createVersionArgs(version, testDb.path);
				let server: TestServer | null = null;
				try {
					server = await createTestServer({ command, args });

					// Verify the server started by calling a simple tool
					const result = await server.callTool("search_facts", {
						limit: 1,
					});

					// The call should succeed (even if no facts exist)
					expect(result.isError).toBeFalsy();
					console.log(`✓ Version ${version} migrations successful`);
				} catch (error) {
					console.error(`✗ Version ${version} failed:`, error);
					throw new Error(
						`Migration failed at version ${version}: ${error instanceof Error ? error.message : String(error)}`,
					);
				} finally {
					await closeServer(server);
				}
			}

			// Verify database was created
			expect(await testDb.exists()).toBe(true);
		}, 180000); // 3 minute timeout for sequential migrations (Windows needs more time)

		it("should migrate from last published version to current development", async () => {
			// Skip if no published versions
			if (publishedVersions.length === 0) {
				console.log("No published versions found, skipping dev migration test");
				return;
			}

			const lastPublishedVersion =
				publishedVersions[publishedVersions.length - 1];

			// Check if the last version is actually published
			if (!(await isVersionPublished(lastPublishedVersion))) {
				console.log(
					`Last version ${lastPublishedVersion} not published on npm, skipping`,
				);
				return;
			}

			console.log(
				`\n=== Testing migration from ${lastPublishedVersion} to development (${CURRENT_VERSION}) ===`,
			);

			// Step 1: Initialize database with last published version
			console.log(
				`\n--- Initializing with version ${lastPublishedVersion} ---`,
			);
			const oldVersionArgs = createVersionArgs(
				lastPublishedVersion,
				testDb.path,
			);
			let server: TestServer | null = null;

			try {
				server = await createTestServer(oldVersionArgs);

				// Add some test data with the old version
				await server.callTool("submit_facts", {
					facts: [
						{
							content: "Migration test fact from " + lastPublishedVersion,
							tags: ["migration-test"],
							verified: true,
						},
					],
				});

				console.log(
					`✓ Initialized database with version ${lastPublishedVersion}`,
				);
			} finally {
				await closeServer(server);
			}

			// Step 2: Run current development version against the same database
			console.log(`\n--- Running development version migrations ---`);
			const devVersionArgs = createVersionArgs(CURRENT_VERSION, testDb.path);

			try {
				server = await createTestServer(devVersionArgs);

				// Verify we can read the data created by the old version
				const result = await server.callTool("search_facts", {
					tags: ["migration-test"],
				});

				expect(result.isError).toBeFalsy();
				const data = parseResult<{ facts: Array<{ content: string }> }>(result);

				// Should find the fact we created
				expect(data.facts.length).toBeGreaterThan(0);
				expect(data.facts[0].content).toContain("Migration test fact");

				// Add new data with development version
				const submitResult = await server.callTool("submit_facts", {
					facts: [
						{
							content:
								"Migration test fact from development " + CURRENT_VERSION,
							tags: ["migration-test", "development"],
							verified: true,
						},
					],
				});

				expect(submitResult.isError).toBeFalsy();

				// Verify both facts exist
				const finalResult = await server.callTool("search_facts", {
					tags: ["migration-test"],
				});

				const finalData = parseResult<{ facts: Array<{ content: string }> }>(
					finalResult,
				);
				expect(finalData.facts.length).toBe(2);

				console.log(
					`✓ Development version (${CURRENT_VERSION}) successfully migrated from ${lastPublishedVersion}`,
				);
			} finally {
				await closeServer(server);
			}
		}, 90000); // 1.5 minute timeout (Windows needs more time)
	});

	describe("individual version migrations", () => {
		// Generate a test for each published version
		// This allows us to see which specific version fails

		beforeEach(async () => {
			await testDb.cleanup();
		});

		it("should successfully run migrations for each version", async () => {
			const tags = await getReleaseTags();
			const versions = tags.map((tag) => tag.replace(/^v/, ""));

			for (const version of versions) {
				// Check if version is published
				if (!(await isVersionPublished(version))) {
					console.log(`Version ${version} not published, skipping`);
					continue;
				}

				const { command, args } = createVersionArgs(version, testDb.path);
				let server: TestServer | null = null;
				try {
					server = await createTestServer({ command, args });

					// Basic health check
					const result = await server.callTool("search_facts", { limit: 1 });
					expect(result.isError).toBeFalsy();
					console.log(`✓ Version ${version} migrations successful`);
				} finally {
					await closeServer(server);
				}

				// Clean up for next version
				await testDb.cleanup();
			}
		}, 600000); // 5 minute timeout for all versions
	});

	describe("version upgrade paths", () => {
		beforeEach(async () => {
			await testDb.cleanup();
		});

		it("should preserve data integrity across all version upgrades", async () => {
			// Skip if we don't have enough versions
			if (publishedVersions.length < 2) {
				console.log("Need at least 2 versions to test upgrade paths");
				return;
			}

			// Filter to available versions
			const availableVersions: string[] = [];
			for (const version of publishedVersions) {
				if (await isVersionPublished(version)) {
					availableVersions.push(version);
				}
			}

			if (availableVersions.length < 2) {
				console.log("Need at least 2 published versions");
				return;
			}

			console.log("\n=== Testing data preservation across upgrades ===");

			// Start with first version and add data
			const firstVersion = availableVersions[0];
			const { command: firstCmd, args: firstArgs } = createVersionArgs(
				firstVersion,
				testDb.path,
			);

			let server: TestServer | null = null;
			try {
				server = await createTestServer({ command: firstCmd, args: firstArgs });

				await server.callTool("submit_facts", {
					facts: [
						{
							content: `Baseline fact from ${firstVersion}`,
							tags: ["upgrade-test", "baseline"],
							verified: true,
						},
					],
				});

				console.log(`✓ Created baseline with ${firstVersion}`);
			} finally {
				await closeServer(server);
			}

			// Upgrade through each version
			for (let i = 1; i < availableVersions.length; i++) {
				const version = availableVersions[i];
				const { command, args } = createVersionArgs(version, testDb.path);

				try {
					server = await createTestServer({ command, args });

					// Verify baseline data still exists
					const result = await server.callTool("search_facts", {
						tags: ["baseline"],
					});
					expect(result.isError).toBeFalsy();

					const data = parseResult<{ facts: Array<{ content: string }> }>(
						result,
					);
					expect(data.facts.length).toBeGreaterThan(0);
					expect(data.facts[0].content).toContain("Baseline fact");

					// Add version-specific data
					await server.callTool("submit_facts", {
						facts: [
							{
								content: `Upgrade fact from ${version}`,
								tags: ["upgrade-test", `v${version.replace(/\./g, "-")}`],
								verified: true,
							},
						],
					});

					console.log(`✓ Version ${version} preserved data and added new fact`);
				} finally {
					await closeServer(server);
				}
			}

			// Final verification with development version
			const { command: devCmd, args: devArgs } = createVersionArgs(
				CURRENT_VERSION,
				testDb.path,
			);

			try {
				server = await createTestServer({ command: devCmd, args: devArgs });

				const result = await server.callTool("search_facts", {
					tags: ["upgrade-test"],
				});
				expect(result.isError).toBeFalsy();

				const data = parseResult<{ facts: Array<{ content: string }> }>(result);

				// Should have: baseline + one for each upgrade + potentially dev
				const expectedMinFacts = availableVersions.length;
				expect(data.facts.length).toBeGreaterThanOrEqual(expectedMinFacts);

				console.log(
					`✓ Development version verified ${data.facts.length} facts preserved`,
				);
			} finally {
				await closeServer(server);
			}
		}, 600000); // 5 minute timeout (increased for Windows)
	});
});
