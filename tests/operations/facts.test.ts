import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import {
	submitFacts,
	searchFacts,
	deleteFacts,
	updateFact,
	verifyFacts,
	verifyFactsByTags,
} from "../../src/db/operations/facts";
import { setConfig } from "../../src/db/operations/config";
import { encodeCursor } from "../../src/utils/cursor";

describe("facts operations - extended coverage", () => {
	let db: TestDB;

	beforeEach(async () => {
		db = await createTestDb();
		await setConfig(db, "skills_dir", "/tmp/factsets-test");
	});

	describe("searchFacts pagination", () => {
		it("uses cursor for pagination", async () => {
			// Create enough facts to paginate
			await submitFacts(db, {
				facts: Array.from({ length: 10 }, (_, i) => ({
					content: `Fact number ${i + 1}`,
					tags: ["test"],
				})),
			});

			// First page
			const page1 = await searchFacts(db, { tags: ["test"], limit: 3 });
			expect(page1.facts).toHaveLength(3);
			expect(page1.nextCursor).toBeDefined();

			// Second page using cursor
			const page2 = await searchFacts(db, {
				tags: ["test"],
				limit: 3,
				cursor: page1.nextCursor,
			});
			expect(page2.facts).toHaveLength(3);
			expect(page2.nextCursor).toBeDefined();

			// Verify different facts
			const page1Ids = page1.facts.map((f) => f.id);
			const page2Ids = page2.facts.map((f) => f.id);
			expect(page1Ids).not.toEqual(page2Ids);
		});

		it("throws error for invalid cursor", async () => {
			await submitFacts(db, {
				facts: [{ content: "Test fact", tags: ["test"] }],
			});

			await expect(
				searchFacts(db, { tags: ["test"], cursor: "invalid-cursor" }),
			).rejects.toThrow("Invalid cursor");
		});

		it("orders by oldest first", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "First fact", tags: ["test"] },
					{ content: "Second fact", tags: ["test"] },
				],
			});

			const result = await searchFacts(db, {
				tags: ["test"],
				orderBy: "oldest",
			});
			expect(result.facts[0]!.content).toBe("First fact");
		});

		it("orders by usage count", async () => {
			const submitted = await submitFacts(db, {
				facts: [
					{ content: "Popular fact", tags: ["test"] },
					{ content: "Unpopular fact", tags: ["test"] },
				],
			});

			// Simulate usage by searching multiple times (retrieval count gets incremented)
			// We need to update directly since searchFacts increments tag usage, not fact usage
			const { facts: dbFacts } = await import("../../src/db/schema");
			const { eq, sql } = await import("drizzle-orm");

			await db
				.update(dbFacts)
				.set({ retrievalCount: 100 })
				.where(eq(dbFacts.content, "Popular fact"));

			const result = await searchFacts(db, {
				tags: ["test"],
				orderBy: "usage",
			});
			expect(result.facts[0]!.content).toBe("Popular fact");
		});

		it("filters by source type", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Code fact", tags: ["test"], sourceType: "code" },
					{ content: "Doc fact", tags: ["test"], sourceType: "documentation" },
				],
			});

			const result = await searchFacts(db, {
				tags: ["test"],
				sourceType: "code",
			});
			expect(result.facts).toHaveLength(1);
			expect(result.facts[0]!.content).toBe("Code fact");
		});

		it("filters by verified only", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Verified fact", tags: ["test"], verified: true },
					{ content: "Unverified fact", tags: ["test"], verified: false },
				],
			});

			const result = await searchFacts(db, {
				tags: ["test"],
				verifiedOnly: true,
			});
			expect(result.facts).toHaveLength(1);
			expect(result.facts[0]!.content).toBe("Verified fact");
		});

		it("returns suggestedTags when no matching tags found", async () => {
			// Create some tags with facts
			await submitFacts(db, {
				facts: [{ content: "Some fact", tags: ["existing-tag"] }],
			});

			const result = await searchFacts(db, { tags: ["nonexistent-tag"] });
			expect(result.facts).toHaveLength(0);
			expect(result.suggestedTags).toBeDefined();
			expect(result.suggestedTags).toContain("existing-tag");
		});

		it("returns suggestedTags when results are empty after filtering", async () => {
			await submitFacts(db, {
				facts: [{ content: "Unverified", tags: ["test"], verified: false }],
			});

			const result = await searchFacts(db, {
				tags: ["test"],
				verifiedOnly: true,
			});
			expect(result.facts).toHaveLength(0);
			expect(result.suggestedTags).toBeDefined();
		});
	});

	describe("deleteFacts", () => {
		it("deletes facts by ids", async () => {
			const submitted = await submitFacts(db, {
				facts: [
					{ content: "Fact 1", tags: ["test"] },
					{ content: "Fact 2", tags: ["test"] },
				],
			});

			const deleted = await deleteFacts(db, {
				ids: [submitted.facts[0]!.id],
			});
			expect(deleted).toBe(1);

			const remaining = await searchFacts(db, { tags: ["test"] });
			expect(remaining.facts).toHaveLength(1);
		});

		it("deletes facts by tags", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Tag A fact", tags: ["tag-a"] },
					{ content: "Tag B fact", tags: ["tag-b"] },
				],
			});

			const deleted = await deleteFacts(db, { tags: ["tag-a"] });
			expect(deleted).toBe(1);

			const tagA = await searchFacts(db, { tags: ["tag-a"] });
			expect(tagA.facts).toHaveLength(0);

			const tagB = await searchFacts(db, { tags: ["tag-b"] });
			expect(tagB.facts).toHaveLength(1);
		});

		it("deletes facts older than date", async () => {
			await submitFacts(db, {
				facts: [{ content: "Old fact", tags: ["test"] }],
			});

			// Delete facts older than tomorrow (should delete all)
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);

			const deleted = await deleteFacts(db, {
				olderThan: tomorrow.toISOString(),
			});
			expect(deleted).toBe(1);
		});

		it("deletes only unverified facts when unverifiedOnly is true", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Verified", tags: ["test"], verified: true },
					{ content: "Unverified", tags: ["test"], verified: false },
				],
			});

			const deleted = await deleteFacts(db, {
				tags: ["test"],
				unverifiedOnly: true,
			});
			expect(deleted).toBe(1);

			const remaining = await searchFacts(db, { tags: ["test"] });
			expect(remaining.facts).toHaveLength(1);
			expect(remaining.facts[0]!.content).toBe("Verified");
		});

		it("returns 0 when no conditions provided", async () => {
			await submitFacts(db, {
				facts: [{ content: "Fact", tags: ["test"] }],
			});

			const deleted = await deleteFacts(db, {});
			expect(deleted).toBe(0);
		});

		it("returns 0 when tags do not match any facts", async () => {
			await submitFacts(db, {
				facts: [{ content: "Fact", tags: ["test"] }],
			});

			const deleted = await deleteFacts(db, { tags: ["nonexistent"] });
			expect(deleted).toBe(0);
		});
	});

	describe("updateFact edge cases", () => {
		it("updates fact source field", async () => {
			const submitted = await submitFacts(db, {
				facts: [{ content: "Fact", tags: ["test"], source: "old-source" }],
			});

			const result = await updateFact(db, {
				id: submitted.facts[0]!.id,
				updates: { source: "new-source" },
			});

			expect(result.success).toBe(true);
		});

		it("updates fact source type", async () => {
			const submitted = await submitFacts(db, {
				facts: [{ content: "Fact", tags: ["test"], sourceType: "code" }],
			});

			const result = await updateFact(db, {
				id: submitted.facts[0]!.id,
				updates: { sourceType: "documentation" },
			});

			expect(result.success).toBe(true);
		});

		it("replaces all tags with new set", async () => {
			const submitted = await submitFacts(db, {
				facts: [{ content: "Fact", tags: ["old-tag-1", "old-tag-2"] }],
			});

			const result = await updateFact(db, {
				id: submitted.facts[0]!.id,
				updates: { tags: ["new-tag"] },
			});

			expect(result.success).toBe(true);
			expect(result.tagsAdded).toContain("new-tag");

			// Verify old tags removed
			const oldSearch = await searchFacts(db, { tags: ["old-tag-1"] });
			expect(oldSearch.facts).toHaveLength(0);

			const newSearch = await searchFacts(db, { tags: ["new-tag"] });
			expect(newSearch.facts).toHaveLength(1);
		});
	});

	describe("verifyFacts", () => {
		it("verifies multiple facts by ids", async () => {
			const submitted = await submitFacts(db, {
				facts: [
					{ content: "Fact 1", tags: ["test"], verified: false },
					{ content: "Fact 2", tags: ["test"], verified: false },
				],
			});

			await verifyFacts(db, {
				ids: submitted.facts.map((f) => f.id),
			});

			const result = await searchFacts(db, {
				tags: ["test"],
				verifiedOnly: true,
			});
			expect(result.facts).toHaveLength(2);
		});
	});

	describe("verifyFactsByTags edge cases", () => {
		it("returns zero when tags do not exist", async () => {
			const result = await verifyFactsByTags(db, {
				tags: ["nonexistent"],
				requireAll: false,
			});

			expect(result.verified).toBe(0);
			expect(result.factIds).toHaveLength(0);
		});

		it("returns zero when no facts have the tags", async () => {
			await submitFacts(db, {
				facts: [{ content: "Fact", tags: ["other"] }],
			});

			const result = await verifyFactsByTags(db, {
				tags: ["missing"],
				requireAll: false,
			});

			expect(result.verified).toBe(0);
		});
	});
});
