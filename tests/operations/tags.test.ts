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
});
