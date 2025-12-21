import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import {
	listTags,
	createTags,
	getTagByName,
	getOrCreateTags,
	incrementTagUsage,
	getTagIdsForSearch,
	getSuggestedTags,
	pruneOrphanTags,
} from "../../src/db/operations/tags";
import { submitFacts } from "../../src/db/operations/facts";
import { setConfig } from "../../src/db/operations/config";

describe("tags operations - extended coverage", () => {
	let db: TestDB;

	beforeEach(async () => {
		db = await createTestDb();
		await setConfig(db, "skills_dir", "/tmp/factsets-test");
	});

	describe("listTags ordering", () => {
		it("orders by name", async () => {
			await createTags(db, {
				tags: [
					{ name: "zebra", description: "Z tag" },
					{ name: "apple", description: "A tag" },
					{ name: "mango", description: "M tag" },
				],
			});

			const result = await listTags(db, { orderBy: "name" });
			expect(result.tags[0]!.name).toBe("apple");
			expect(result.tags[1]!.name).toBe("mango");
			expect(result.tags[2]!.name).toBe("zebra");
		});

		it("orders by recent", async () => {
			await createTags(db, {
				tags: [{ name: "first", description: "First tag" }],
			});

			// Manually update timestamp to be newer for second tag
			await createTags(db, {
				tags: [{ name: "second", description: "Second tag" }],
			});
			const { tags } = await import("../../src/db/schema");
			const { eq } = await import("drizzle-orm");
			const futureDate = new Date();
			futureDate.setMinutes(futureDate.getMinutes() + 5);
			await db
				.update(tags)
				.set({ createdAt: futureDate.toISOString() })
				.where(eq(tags.name, "second"));

			const result = await listTags(db, { orderBy: "recent" });
			expect(result.tags[0]!.name).toBe("second");
		});

		it("orders by usage count by default", async () => {
			await createTags(db, {
				tags: [
					{ name: "popular", description: "Popular tag" },
					{ name: "unpopular", description: "Unpopular tag" },
				],
			});

			// Increment usage for popular tag
			const { tags } = await import("../../src/db/schema");
			const { eq } = await import("drizzle-orm");
			await db
				.update(tags)
				.set({ usageCount: 100 })
				.where(eq(tags.name, "popular"));

			const result = await listTags(db, {});
			expect(result.tags[0]!.name).toBe("popular");
		});
	});

	describe("createTags", () => {
		it("returns empty result for empty input", async () => {
			const result = await createTags(db, { tags: [] });
			expect(result.created).toBe(0);
			expect(result.tags).toHaveLength(0);
		});

		it("creates tags with descriptions", async () => {
			const result = await createTags(db, {
				tags: [
					{ name: "react", description: "React framework" },
					{ name: "hooks", description: "React hooks" },
				],
			});

			expect(result.created).toBe(2);
		});
	});

	describe("getTagByName", () => {
		it("returns tag when found", async () => {
			await createTags(db, {
				tags: [{ name: "exists", description: "Existing tag" }],
			});

			const result = await getTagByName(db, "exists");
			expect(result).not.toBeNull();
			expect(result!.name).toBe("exists");
		});

		it("returns null when not found", async () => {
			const result = await getTagByName(db, "nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("getOrCreateTags", () => {
		it("creates missing tags", async () => {
			const result = await getOrCreateTags(db, ["new-tag-1", "new-tag-2"]);

			expect(result.size).toBe(2);
			expect(result.has("new-tag-1")).toBe(true);
			expect(result.has("new-tag-2")).toBe(true);
		});

		it("returns existing tags", async () => {
			await createTags(db, {
				tags: [{ name: "existing", description: "Existing tag" }],
			});

			const result = await getOrCreateTags(db, ["existing", "new"]);

			expect(result.size).toBe(2);
		});

		it("returns empty map for empty input", async () => {
			const result = await getOrCreateTags(db, []);
			expect(result.size).toBe(0);
		});

		it("deduplicates names", async () => {
			const result = await getOrCreateTags(db, ["dupe", "dupe", "dupe"]);
			expect(result.size).toBe(1);
		});
	});

	describe("incrementTagUsage", () => {
		it("increments usage count for multiple tags", async () => {
			const tags = await createTags(db, {
				tags: [
					{ name: "tag-a", description: "Tag A" },
					{ name: "tag-b", description: "Tag B" },
				],
			});

			await incrementTagUsage(
				db,
				tags.tags.map((t) => t.id),
			);

			const result = await listTags(db, {});
			for (const tag of result.tags) {
				expect(tag.usageCount).toBe(1);
			}
		});

		it("handles empty array gracefully", async () => {
			await expect(incrementTagUsage(db, [])).resolves.toBeUndefined();
		});
	});

	describe("getTagIdsForSearch", () => {
		it("returns shouldReturnEmpty=false for empty tags", async () => {
			const result = await getTagIdsForSearch(db, []);
			expect(result.tagIds).toHaveLength(0);
			expect(result.shouldReturnEmpty).toBe(false);
		});

		it("returns shouldReturnEmpty=false for undefined tags", async () => {
			const result = await getTagIdsForSearch(db, undefined);
			expect(result.tagIds).toHaveLength(0);
			expect(result.shouldReturnEmpty).toBe(false);
		});

		it("returns shouldReturnEmpty=true when no tags match", async () => {
			const result = await getTagIdsForSearch(db, ["nonexistent"]);
			expect(result.tagIds).toHaveLength(0);
			expect(result.shouldReturnEmpty).toBe(true);
		});

		it("returns tag ids when tags exist", async () => {
			await createTags(db, {
				tags: [{ name: "exists", description: "Existing tag" }],
			});

			const result = await getTagIdsForSearch(db, ["exists"]);
			expect(result.tagIds).toHaveLength(1);
			expect(result.shouldReturnEmpty).toBe(false);
		});
	});

	describe("getSuggestedTags", () => {
		it("returns popular tags", async () => {
			await createTags(db, {
				tags: [
					{ name: "popular", description: "Popular tag" },
					{ name: "unpopular", description: "Unpopular tag" },
				],
			});

			// Make one popular
			const { tags } = await import("../../src/db/schema");
			const { eq } = await import("drizzle-orm");
			await db
				.update(tags)
				.set({ usageCount: 100 })
				.where(eq(tags.name, "popular"));

			const result = await getSuggestedTags(db, 1);
			expect(result).toHaveLength(1);
			expect(result[0]).toBe("popular");
		});

		it("respects limit", async () => {
			await createTags(db, {
				tags: [
					{ name: "a", description: "A tag" },
					{ name: "b", description: "B tag" },
					{ name: "c", description: "C tag" },
				],
			});

			const result = await getSuggestedTags(db, 2);
			expect(result).toHaveLength(2);
		});

		it("returns empty array when no tags exist", async () => {
			const result = await getSuggestedTags(db, 5);
			expect(result).toHaveLength(0);
		});
	});

	describe("pruneOrphanTags", () => {
		it("prunes tags not linked to any entities", async () => {
			// Create tags without linking them to anything
			await createTags(db, {
				tags: [
					{ name: "orphan1", description: "Orphan tag 1" },
					{ name: "orphan2", description: "Orphan tag 2" },
				],
			});

			const result = await pruneOrphanTags(db, {});
			expect(result.pruned).toBe(2);

			// Verify tags are deleted
			const remaining = await listTags(db, {});
			expect(remaining.tags).toHaveLength(0);
		});

		it("does not prune tags linked to facts", async () => {
			await createTags(db, {
				tags: [{ name: "used-by-fact", description: "Used by fact" }],
			});

			// Create a fact that uses the tag
			await submitFacts(db, {
				facts: [{ content: "Test fact", tags: ["used-by-fact"] }],
			});

			const result = await pruneOrphanTags(db, {});
			expect(result.pruned).toBe(0);

			const remaining = await listTags(db, {});
			expect(remaining.tags).toHaveLength(1);
			expect(remaining.tags[0]!.name).toBe("used-by-fact");
		});

		it("returns orphan list in dry run mode without deleting", async () => {
			await createTags(db, {
				tags: [{ name: "orphan-dry", description: "Orphan for dry run" }],
			});

			const result = await pruneOrphanTags(db, { dryRun: true });
			expect(result.pruned).toBe(1);
			expect(result.orphanTags).toBeDefined();
			expect(result.orphanTags).toHaveLength(1);
			expect(result.orphanTags![0]!.name).toBe("orphan-dry");

			// Verify tag is NOT deleted in dry run
			const remaining = await listTags(db, {});
			expect(remaining.tags).toHaveLength(1);
		});

		it("returns zero when all tags are in use", async () => {
			// Create a fact with a tag - this automatically creates the tag
			await submitFacts(db, {
				facts: [{ content: "Test fact", tags: ["active-tag"] }],
			});

			const result = await pruneOrphanTags(db, {});
			expect(result.pruned).toBe(0);
		});

		it("handles mixed used and orphan tags", async () => {
			// Create used tag through fact
			await submitFacts(db, {
				facts: [{ content: "Test fact", tags: ["used-tag"] }],
			});

			// Create orphan tags directly
			await createTags(db, {
				tags: [{ name: "orphan-mixed", description: "Orphan tag" }],
			});

			const result = await pruneOrphanTags(db, {});
			expect(result.pruned).toBe(1);

			const remaining = await listTags(db, {});
			expect(remaining.tags).toHaveLength(1);
			expect(remaining.tags[0]!.name).toBe("used-tag");
		});
	});
});
