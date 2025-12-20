import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import {
	checkStale,
	markResourcesRefreshed,
} from "../../src/db/operations/staleness";
import { addResources } from "../../src/db/operations/resources";
import { submitFacts } from "../../src/db/operations/facts";
import { createSkill } from "../../src/db/operations/skills";
import { setConfig } from "../../src/db/operations/config";

describe("staleness operations - extended coverage", () => {
	let db: TestDB;

	beforeEach(async () => {
		db = await createTestDb();
		await setConfig(db, "skills_dir", "/tmp/factsets-test");
	});

	describe("checkStale", () => {
		it("identifies stale resources past threshold", async () => {
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

			// Make resource stale
			const { resources } = await import("../../src/db/schema");
			const { eq } = await import("drizzle-orm");
			const oldDate = new Date();
			oldDate.setHours(oldDate.getHours() - 48);
			await db
				.update(resources)
				.set({ lastVerifiedAt: oldDate.toISOString() })
				.where(eq(resources.uri, "file:///stale.ts"));

			const result = await checkStale(db, { maxAgeHours: 24 });
			expect(result.staleResources).toHaveLength(1);
		});

		it("identifies unverified facts past threshold", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Unverified fact", tags: ["test"], verified: false },
				],
			});

			// Make fact old
			const { facts } = await import("../../src/db/schema");
			const { eq } = await import("drizzle-orm");
			const oldDate = new Date();
			oldDate.setHours(oldDate.getHours() - 48);
			await db
				.update(facts)
				.set({ createdAt: oldDate.toISOString() })
				.where(eq(facts.content, "Unverified fact"));

			const result = await checkStale(db, { maxAgeHours: 24 });
			expect(result.unverifiedFacts).toHaveLength(1);
		});

		it("returns staleSkills array in output", async () => {
			// Create a skill with a resource dependency
			const resourceResult = await addResources(db, {
				resources: [
					{
						uri: "file:///dep.ts",
						type: "file",
						tags: ["test"],
						snapshot: "original",
					},
				],
			});

			await createSkill(db, {
				name: "linked-skill",
				title: "Linked Skill",
				content: "# Skill",
				tags: ["test"],
				references: {
					resources: [resourceResult.resources[0]!.id],
				},
			});

			const result = await checkStale(db, { maxAgeHours: 24 });
			// Verify the output structure has staleSkills array
			expect(Array.isArray(result.staleSkills)).toBe(true);
			expect(result.summary).toBeDefined();
		});

		it("returns empty arrays when nothing is stale", async () => {
			// Just create fresh resources with no skills
			await addResources(db, {
				resources: [
					{
						uri: "file:///fresh.ts",
						type: "file",
						tags: ["test"],
						snapshot: "content",
					},
				],
			});

			await submitFacts(db, {
				facts: [{ content: "Verified fact", tags: ["test"], verified: true }],
			});

			const result = await checkStale(db, { maxAgeHours: 24 });
			expect(result.staleResources).toHaveLength(0);
			expect(result.unverifiedFacts).toHaveLength(0);
			// staleSkills might include recently created skill if any
		});
	});

	describe("markResourcesRefreshed", () => {
		it("marks resources as refreshed", async () => {
			const added = await addResources(db, {
				resources: [
					{ uri: "file:///a.ts", type: "file", tags: ["test"], snapshot: "a" },
					{ uri: "file:///b.ts", type: "file", tags: ["test"], snapshot: "b" },
				],
			});

			// Make stale first
			const { resources } = await import("../../src/db/schema");
			const { inArray } = await import("drizzle-orm");
			const oldDate = new Date();
			oldDate.setHours(oldDate.getHours() - 48);
			await db
				.update(resources)
				.set({ lastVerifiedAt: oldDate.toISOString() })
				.where(
					inArray(
						resources.id,
						added.resources.map((r) => r.id),
					),
				);

			// Mark as refreshed - pass array of IDs directly
			const result = await markResourcesRefreshed(
				db,
				added.resources.map((r) => r.id),
			);

			expect(result.affected).toBe(2);

			// Verify no longer stale
			const stale = await checkStale(db, { maxAgeHours: 24 });
			expect(stale.staleResources).toHaveLength(0);
		});

		it("returns zero for empty input", async () => {
			const result = await markResourcesRefreshed(db, []);
			expect(result.affected).toBe(0);
		});
	});
});
