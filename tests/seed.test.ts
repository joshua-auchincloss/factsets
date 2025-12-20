import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { createTestDb, type TestDB } from "./harness";
import {
	applySeed,
	getSeedVersion,
	getSystemContent,
} from "../src/seed/index.js";
import type { SeedManifest } from "../src/seed/manifest.js";
import { tags, facts } from "../src/db/schema.js";
import { setConfig } from "../src/db/operations/config.js";
import { eq } from "drizzle-orm";

const TEST_SKILLS_DIR = "/tmp/factsets-seed-test-skills";

describe("seeding", () => {
	let db: TestDB;

	beforeEach(async () => {
		db = await createTestDb();
		// Configure skills dir to avoid permission issues
		await setConfig(db, "skills_dir", TEST_SKILLS_DIR);
		await rm(TEST_SKILLS_DIR, { recursive: true, force: true });
		await mkdir(TEST_SKILLS_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(TEST_SKILLS_DIR, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	it("applies seed manifest on first run", async () => {
		const manifest: SeedManifest = {
			version: 1,
			tags: [
				{
					name: "test-system",
					description: "Test system tag",
					systemId: "test:tag:system",
				},
			],
			facts: [
				{
					content: "Test fact content",
					tags: ["test-system"],
					systemId: "test:fact:1",
					verified: true,
				},
			],
			skills: [], // Skip skills to avoid file system side effects
		};

		const result = await applySeed(db, manifest);

		expect(result.version).toBe(1);
		expect(result.tags.created).toBe(1);
		expect(result.facts.created).toBe(1);

		// Verify seed version is stored
		const version = await getSeedVersion(db);
		expect(version).toBe(1);
	});

	it("skips seeding if already at version", async () => {
		const manifest: SeedManifest = {
			version: 1,
			tags: [
				{
					name: "test-tag",
					description: "Test",
					systemId: "test:tag:1",
				},
			],
			facts: [],
			skills: [],
		};

		// First apply
		await applySeed(db, manifest);

		// Second apply should skip
		const result = await applySeed(db, manifest);

		expect(result.tags.created).toBe(0);
		expect(result.tags.skipped).toBe(0);
	});

	it("applies new version with updates", async () => {
		const v1: SeedManifest = {
			version: 1,
			tags: [
				{
					name: "evolving-tag",
					description: "Version 1",
					systemId: "test:tag:evolving",
				},
			],
			facts: [],
			skills: [],
		};

		await applySeed(db, v1);

		const v2: SeedManifest = {
			version: 2,
			tags: [
				{
					name: "evolving-tag",
					description: "Version 2 updated",
					systemId: "test:tag:evolving",
				},
				{
					name: "new-tag-v2",
					description: "Added in v2",
					systemId: "test:tag:new-v2",
				},
			],
			facts: [],
			skills: [],
		};

		const result = await applySeed(db, v2);

		expect(result.version).toBe(2);
		expect(result.tags.created).toBe(1); // new-tag-v2
		expect(result.tags.updated).toBe(1); // evolving-tag description changed
	});

	it("claims existing content by name", async () => {
		// Create a tag without systemId (user-created)
		await db.insert(tags).values({
			name: "user-tag",
			description: "Created by user",
		});

		const manifest: SeedManifest = {
			version: 1,
			tags: [
				{
					name: "user-tag", // Same name
					description: "System description",
					systemId: "system:tag:user-tag",
				},
			],
			facts: [],
			skills: [],
		};

		const result = await applySeed(db, manifest);

		expect(result.tags.updated).toBe(1); // Claimed existing tag

		// Verify systemId was added
		const tagResult = await db
			.select()
			.from(tags)
			.where(eq(tags.name, "user-tag"));
		expect(tagResult[0]?.systemId).toBe("system:tag:user-tag");
	});

	it("returns system content", async () => {
		const manifest: SeedManifest = {
			version: 1,
			tags: [
				{
					name: "sys-tag",
					description: "System",
					systemId: "sys:tag:1",
				},
			],
			facts: [
				{
					content: "System fact",
					tags: ["sys-tag"],
					systemId: "sys:fact:1",
				},
			],
			skills: [],
		};

		await applySeed(db, manifest);

		const system = await getSystemContent(db);

		expect(system.tags.length).toBe(1);
		expect(system.tags[0]?.systemId).toBe("sys:tag:1");
		expect(system.facts.length).toBe(1);
		expect(system.facts[0]?.systemId).toBe("sys:fact:1");
	});

	it("does not overwrite user-modified content", async () => {
		const manifest: SeedManifest = {
			version: 1,
			tags: [],
			facts: [
				{
					content: "Original system content",
					tags: [],
					systemId: "sys:fact:modifiable",
				},
			],
			skills: [],
		};

		await applySeed(db, manifest);

		// Simulate user modifying the content
		await db
			.update(facts)
			.set({ content: "User modified content" })
			.where(eq(facts.systemId, "sys:fact:modifiable"));

		// New version with updated content
		const v2: SeedManifest = {
			version: 2,
			tags: [],
			facts: [
				{
					content: "Updated system content v2",
					tags: [],
					systemId: "sys:fact:modifiable",
				},
			],
			skills: [],
		};

		const result = await applySeed(db, v2);

		// Should skip because user modified
		expect(result.facts.skipped).toBe(1);

		// Verify user content is preserved
		const factResult = await db
			.select()
			.from(facts)
			.where(eq(facts.systemId, "sys:fact:modifiable"));
		expect(factResult[0]?.content).toBe("User modified content");
	});
});
