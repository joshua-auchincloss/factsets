import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import { resetFactories } from "../factories";
import {
	submitFacts,
	deleteFacts,
	searchFacts,
} from "../../src/db/operations/facts";
import {
	addResources,
	updateResourceSnapshot,
	getResource,
} from "../../src/db/operations/resources";
import { createSkill } from "../../src/db/operations/skills";
import {
	checkStale,
	markResourcesRefreshed,
} from "../../src/db/operations/staleness";
import { setConfig } from "../../src/db/operations/config";
import { sql } from "drizzle-orm";
import { resources, facts } from "../../src/db/schema";
import { mkdir, rm } from "node:fs/promises";
import dayjs from "dayjs";

const TEST_SKILLS_DIR = "/tmp/factsets-test-skills";

describe("maintenance workflow", () => {
	let db: TestDB;

	beforeEach(async () => {
		resetFactories();
		db = await createTestDb();
		await setConfig(db, "skills_dir", TEST_SKILLS_DIR);
		await rm(TEST_SKILLS_DIR, { recursive: true, force: true });
		await mkdir(TEST_SKILLS_DIR, { recursive: true });
	});

	describe("staleness detection", () => {
		it("identifies resources past staleness threshold", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///old.ts",
						type: "file",
						tags: ["test"],
						snapshot: "old content",
					},
				],
			});

			const tenDaysAgo = dayjs().subtract(10, "day").toISOString();
			await db
				.update(resources)
				.set({ lastVerifiedAt: tenDaysAgo })
				.where(sql`1=1`);

			const result = await checkStale(db, { maxAgeHours: 168 });

			expect(result.staleResources).toHaveLength(1);
			expect(result.staleResources[0]!.uri).toBe("file:///old.ts");
			expect(result.staleResources[0]!.daysStale).toBeGreaterThanOrEqual(10);
		});

		it("identifies skills with changed resource dependencies", async () => {
			const resource = await addResources(db, {
				resources: [
					{
						uri: "file:///dep.ts",
						type: "file",
						tags: ["dep"],
						snapshot: "v1",
					},
				],
			});

			const skill = await createSkill(db, {
				name: "dependent-skill",
				title: "Dependent",
				content: "# Depends on resource",
				tags: ["test"],
				references: { resources: resource.resources.map((r) => r.id) },
			});

			await updateResourceSnapshot(db, {
				uri: "file:///dep.ts",
				snapshot: "v2 - changed!",
			});

			const result = await checkStale(db, { maxAgeHours: 168 });

			const staleSkill = result.staleSkills.find((s) => s.name === skill.name);
			expect(staleSkill).toBeDefined();
			expect(staleSkill?.reason).toBe("resource_changed");
			expect(staleSkill?.staleDependencies).toHaveLength(1);
		});

		it("identifies unverified facts past threshold", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Unverified old fact", tags: ["test"], verified: false },
				],
			});

			const tenDaysAgo = dayjs().subtract(10, "day").toISOString();
			await db.update(facts).set({ createdAt: tenDaysAgo }).where(sql`1=1`);

			const result = await checkStale(db, {
				maxAgeHours: 168,
				checkResources: false,
				checkSkills: false,
			});

			expect(result.unverifiedFacts).toHaveLength(1);
			expect(result.unverifiedFacts[0]!.daysOld).toBeGreaterThanOrEqual(10);
		});

		it("returns retrieval methods for stale resources", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "https://api.example.com/data",
						type: "api",
						tags: ["api"],
						snapshot: "{}",
						retrievalMethod: {
							type: "api",
							url: "https://api.example.com/data",
							headers: { Authorization: "Bearer xxx" },
						},
					},
				],
			});

			const tenDaysAgo = dayjs().subtract(10, "day").toISOString();
			await db
				.update(resources)
				.set({ lastVerifiedAt: tenDaysAgo })
				.where(sql`1=1`);

			const result = await checkStale(db, { maxAgeHours: 168 });

			expect(result.staleResources[0]!.retrievalMethod).toBeDefined();
			expect(result.staleResources[0]!.retrievalMethod?.type).toBe("api");
		});

		it("returns summary counts", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///stale.ts",
						type: "file",
						tags: ["test"],
						snapshot: "content",
					},
				],
			});
			await submitFacts(db, {
				facts: [{ content: "Unverified", tags: ["test"], verified: false }],
			});

			const tenDaysAgo = dayjs().subtract(10, "day").toISOString();
			await db
				.update(resources)
				.set({ lastVerifiedAt: tenDaysAgo })
				.where(sql`1=1`);
			await db.update(facts).set({ createdAt: tenDaysAgo }).where(sql`1=1`);

			const result = await checkStale(db, { maxAgeHours: 168 });

			expect(result.summary.resources).toBe(1);
			expect(result.summary.facts).toBe(1);
			expect(result.summary.totalStale).toBeGreaterThanOrEqual(2);
		});
	});

	describe("refresh cycle", () => {
		it("updates resource snapshot after agent fetch", async () => {
			const added = await addResources(db, {
				resources: [
					{
						uri: "file:///refreshable.ts",
						type: "file",
						tags: ["test"],
						snapshot: "old",
					},
				],
			});

			await updateResourceSnapshot(db, {
				id: added.resources[0]!.id,
				snapshot: "new content after fetch",
			});

			const resource = await getResource(db, { id: added.resources[0]!.id });
			expect(resource?.content).toBe("new content after fetch");
			expect(resource?.isFresh).toBe(true);
		});

		it("marks resources as refreshed", async () => {
			const added = await addResources(db, {
				resources: [
					{
						uri: "file:///r1.ts",
						type: "file",
						tags: ["test"],
						snapshot: "s1",
					},
					{
						uri: "file:///r2.ts",
						type: "file",
						tags: ["test"],
						snapshot: "s2",
					},
				],
			});

			const tenDaysAgo = dayjs().subtract(10, "day").toISOString();
			await db
				.update(resources)
				.set({ lastVerifiedAt: tenDaysAgo })
				.where(sql`1=1`);

			const beforeRefresh = await checkStale(db, { maxAgeHours: 168 });
			expect(beforeRefresh.staleResources).toHaveLength(2);

			const ids = added.resources.map((r) => r.id);
			const result = await markResourcesRefreshed(db, ids);

			expect(result.affected).toBe(2);

			const afterRefresh = await checkStale(db, { maxAgeHours: 168 });
			expect(afterRefresh.staleResources).toHaveLength(0);
		});

		it("identifies skills needing review after resource update", async () => {
			const resource = await addResources(db, {
				resources: [
					{
						uri: "file:///tracked.ts",
						type: "file",
						tags: ["tracked"],
						snapshot: "original",
					},
				],
			});

			await createSkill(db, {
				name: "tracking-skill",
				title: "Tracks Resource",
				content: "# Tracks",
				tags: ["test"],
				references: { resources: resource.resources.map((r) => r.id) },
			});

			const ids = resource.resources.map((r) => r.id);
			const result = await markResourcesRefreshed(db, ids);

			expect(result.skillsToReview).toHaveLength(1);
			expect(result.skillsToReview[0]!.name).toBe("tracking-skill");
		});
	});

	describe("cleanup", () => {
		it("deletes unverified facts by age", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Old unverified", tags: ["cleanup"], verified: false },
					{ content: "New unverified", tags: ["cleanup"], verified: false },
				],
			});

			const tenDaysAgo = dayjs().subtract(10, "day").toISOString();

			await db
				.update(facts)
				.set({ createdAt: tenDaysAgo })
				.where(sql`content = 'Old unverified'`);

			const deleted = await deleteFacts(db, {
				olderThan: dayjs().subtract(7, "day").toISOString(),
				unverifiedOnly: true,
			});

			expect(deleted).toBe(1);

			const remaining = await searchFacts(db, { tags: ["cleanup"] });
			expect(remaining.facts).toHaveLength(1);
			expect(remaining.facts[0]!.content).toBe("New unverified");
		});

		it("deletes facts by tag", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Temporary fact 1", tags: ["temporary"] },
					{ content: "Temporary fact 2", tags: ["temporary"] },
					{ content: "Keep this", tags: ["permanent"] },
				],
			});

			const deleted = await deleteFacts(db, { tags: ["temporary"] });

			expect(deleted).toBe(2);

			const remaining = await searchFacts(db, { tags: ["permanent"] });
			expect(remaining.facts).toHaveLength(1);
		});
	});
});
