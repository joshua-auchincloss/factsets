import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, seedTestData, type TestDB } from "../harness";
import { resetFactories } from "../factories";
import { submitFacts, searchFacts } from "../../src/db/operations/facts";
import {
	addResources,
	searchResources,
	getResource,
	getResourceById,
} from "../../src/db/operations/resources";
import {
	createSkill,
	searchSkills,
	getSkill,
} from "../../src/db/operations/skills";
import { listTags } from "../../src/db/operations/tags";
import { setConfig } from "../../src/db/operations/config";
import { mkdir, rm } from "node:fs/promises";

const TEST_SKILLS_DIR = "/tmp/factsets-test-skills";

describe("retrieval workflow", () => {
	let db: TestDB;

	beforeEach(async () => {
		resetFactories();
		db = await createTestDb();
		await setConfig(db, "skills_dir", TEST_SKILLS_DIR);
		await rm(TEST_SKILLS_DIR, { recursive: true, force: true });
		await mkdir(TEST_SKILLS_DIR, { recursive: true });
		await seedTestData(db);
	});

	describe("tag-based discovery", () => {
		it("finds facts by single tag", async () => {
			const result = await searchFacts(db, { tags: ["typescript"] });

			expect(result.facts.length).toBeGreaterThanOrEqual(1);
			expect(
				result.facts.some((f) => f.content.includes("structural typing")),
			).toBe(true);
		});

		it("finds facts by multiple tags", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Fact with both tags", tags: ["multi-a", "multi-b"] },
					{ content: "Fact with only A", tags: ["multi-a"] },
					{ content: "Fact with only B", tags: ["multi-b"] },
				],
			});

			const bothTags = await searchFacts(db, { tags: ["multi-a", "multi-b"] });
			expect(bothTags.facts.length).toBeGreaterThanOrEqual(1);
		});

		it("finds resources by tag and type", async () => {
			const byTag = await searchResources(db, { tags: ["typescript"] });
			expect(byTag.resources.length).toBeGreaterThanOrEqual(1);

			const byType = await searchResources(db, { type: "file" });
			expect(byType.resources.length).toBeGreaterThanOrEqual(1);

			const combined = await searchResources(db, {
				tags: ["typescript"],
				type: "file",
			});
			expect(combined.resources.length).toBeGreaterThanOrEqual(1);
		});

		it("finds skills by tag with staleness indicators", async () => {
			const result = await searchSkills(db, { tags: ["typescript"] });

			expect(result.skills.length).toBeGreaterThanOrEqual(1);
			expect(result.skills[0]).toHaveProperty("hasStaleDeps");
		});
	});

	describe("content-based search", () => {
		it("searches facts by content pattern", async () => {
			await submitFacts(db, {
				facts: [
					{
						content: "This mentions dependency injection pattern",
						tags: ["patterns"],
					},
					{ content: "This is about something else", tags: ["other"] },
				],
			});

			const result = await searchFacts(db, { query: "dependency injection" });

			expect(result.facts).toHaveLength(1);
			expect(result.facts[0]!.content).toContain("dependency injection");
		});

		it("searches resources by URI pattern", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///src/components/Button.tsx",
						type: "file",
						tags: ["component"],
					},
					{
						uri: "file:///src/components/Input.tsx",
						type: "file",
						tags: ["component"],
					},
					{ uri: "file:///src/utils/helpers.ts", type: "file", tags: ["util"] },
				],
			});

			const result = await searchResources(db, { uriPattern: "components" });

			expect(result.resources).toHaveLength(2);
		});

		it("searches skills by title pattern", async () => {
			await createSkill(db, {
				name: "react-testing",
				title: "React Testing Best Practices",
				content: "# Testing",
				tags: ["react", "testing"],
			});

			await createSkill(db, {
				name: "react-hooks",
				title: "React Hooks Guide",
				content: "# Hooks",
				tags: ["react", "hooks"],
			});

			const result = await searchSkills(db, { query: "Testing" });

			expect(result.skills).toHaveLength(1);
			expect(result.skills[0]!.title).toContain("Testing");
		});
	});

	describe("retrieval tracking", () => {
		it("increments retrieval count on resource access", async () => {
			const added = await addResources(db, {
				resources: [
					{
						uri: "file:///tracked-resource.ts",
						type: "file",
						tags: ["track"],
						snapshot: "content",
					},
				],
			});

			const id = added.resources[0]!.id;

			await getResource(db, { id });
			await getResource(db, { id });
			await getResource(db, { id });

			const resource = await getResourceById(db, id);

			expect(resource?.retrievalCount).toBe(3);
		});

		it("increments tag usage on search", async () => {
			await submitFacts(db, {
				facts: [{ content: "Searchable fact", tags: ["usage-track"] }],
			});

			const tagsBefore = await listTags(db, { filter: "usage-track" });
			const usageBefore = tagsBefore.tags[0]!.usageCount;

			await searchFacts(db, { tags: ["usage-track"] });
			await searchFacts(db, { tags: ["usage-track"] });

			const tagsAfter = await listTags(db, { filter: "usage-track" });
			const usageAfter = tagsAfter.tags[0]!.usageCount;

			expect(usageAfter).toBe(usageBefore + 2);
		});
	});

	describe("result limiting", () => {
		it("respects limit parameter for facts", async () => {
			await submitFacts(db, {
				facts: Array.from({ length: 20 }, (_, i) => ({
					content: `Limited fact ${i}`,
					tags: ["limit-test"],
				})),
			});

			const limited = await searchFacts(db, { tags: ["limit-test"], limit: 5 });
			expect(limited.facts).toHaveLength(5);

			const unlimited = await searchFacts(db, {
				tags: ["limit-test"],
				limit: 100,
			});
			expect(unlimited.facts).toHaveLength(20);
		});

		it("respects limit parameter for resources", async () => {
			await addResources(db, {
				resources: Array.from({ length: 15 }, (_, i) => ({
					uri: `file:///limit-${i}.ts`,
					type: "file" as const,
					tags: ["limit-test-res"],
				})),
			});

			const limited = await searchResources(db, {
				tags: ["limit-test-res"],
				limit: 5,
			});
			expect(limited.resources).toHaveLength(5);
		});
	});

	describe("empty results", () => {
		it("returns empty array when no facts match", async () => {
			const result = await searchFacts(db, { tags: ["nonexistent-tag-xyz"] });
			expect(result.facts).toEqual([]);
		});

		it("returns empty array when no resources match", async () => {
			const result = await searchResources(db, {
				tags: ["nonexistent-tag-xyz"],
			});
			expect(result.resources).toEqual([]);
		});

		it("returns null when skill not found", async () => {
			const result = await getSkill(db, { name: "nonexistent-skill" });
			expect(result).toBeNull();
		});
	});
});
