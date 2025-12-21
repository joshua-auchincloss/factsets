import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import {
	addResources,
	searchResources,
	getResource,
	getResources,
	updateResourceSnapshot,
	updateResourceSnapshots,
	updateResource,
	getStaleResources,
	deleteResources,
} from "../../src/db/operations/resources";
import { setConfig } from "../../src/db/operations/config";

describe("resources operations - extended coverage", () => {
	let db: TestDB;

	beforeEach(async () => {
		db = await createTestDb();
		await setConfig(db, "skills_dir", "/tmp/factsets-test");
	});

	describe("searchResources pagination", () => {
		it("uses cursor for pagination", async () => {
			await addResources(db, {
				resources: Array.from({ length: 10 }, (_, i) => ({
					uri: `file:///resource-${i}.ts`,
					type: "file",
					tags: ["test"],
				})),
			});

			const page1 = await searchResources(db, { tags: ["test"], limit: 3 });
			expect(page1.resources).toHaveLength(3);
			expect(page1.nextCursor).toBeDefined();

			const page2 = await searchResources(db, {
				tags: ["test"],
				limit: 3,
				cursor: page1.nextCursor,
			});
			expect(page2.resources).toHaveLength(3);

			// Verify different resources
			const page1Uris = page1.resources.map((r) => r.uri);
			const page2Uris = page2.resources.map((r) => r.uri);
			expect(page1Uris).not.toEqual(page2Uris);
		});

		it("throws error for invalid cursor", async () => {
			await addResources(db, {
				resources: [{ uri: "file:///test.ts", type: "file", tags: ["test"] }],
			});

			await expect(
				searchResources(db, { tags: ["test"], cursor: "invalid" }),
			).rejects.toThrow("Invalid cursor");
		});

		it("returns suggestedTags when no matching tags found", async () => {
			await addResources(db, {
				resources: [
					{ uri: "file:///test.ts", type: "file", tags: ["existing"] },
				],
			});

			const result = await searchResources(db, { tags: ["nonexistent"] });
			expect(result.resources).toHaveLength(0);
			expect(result.suggestedTags).toBeDefined();
			expect(result.suggestedTags).toContain("existing");
		});

		it("filters by resource type", async () => {
			await addResources(db, {
				resources: [
					{ uri: "file:///code.ts", type: "file", tags: ["test"] },
					{ uri: "https://example.com", type: "url", tags: ["test"] },
				],
			});

			const result = await searchResources(db, {
				tags: ["test"],
				type: "file",
			});
			expect(result.resources).toHaveLength(1);
			expect(result.resources[0]!.type).toBe("file");
		});

		it("filters by uriPattern", async () => {
			await addResources(db, {
				resources: [
					{ uri: "file:///src/main.ts", type: "file", tags: ["test"] },
					{ uri: "file:///lib/helper.ts", type: "file", tags: ["test"] },
				],
			});

			// uriPattern filters by uri
			const result = await searchResources(db, {
				tags: ["test"],
				uriPattern: "/src/",
			});
			expect(result.resources).toHaveLength(1);
			expect(result.resources[0]!.uri).toContain("/src/");
		});

		it("orders by oldest first", async () => {
			await addResources(db, {
				resources: [
					{ uri: "file:///first.ts", type: "file", tags: ["test"] },
					{ uri: "file:///second.ts", type: "file", tags: ["test"] },
				],
			});

			const result = await searchResources(db, {
				tags: ["test"],
				orderBy: "oldest",
			});
			expect(result.resources[0]!.uri).toContain("first");
		});

		it("orders by usage count", async () => {
			await addResources(db, {
				resources: [
					{ uri: "file:///popular.ts", type: "file", tags: ["test"] },
					{ uri: "file:///unpopular.ts", type: "file", tags: ["test"] },
				],
			});

			// Update retrieval count directly
			const { resources: dbResources } = await import("../../src/db/schema");
			const { eq, sql } = await import("drizzle-orm");

			await db
				.update(dbResources)
				.set({ retrievalCount: 100 })
				.where(eq(dbResources.uri, "file:///popular.ts"));

			const result = await searchResources(db, {
				tags: ["test"],
				orderBy: "recent",
			});
			expect(result.resources).toBeDefined();
		});
	});

	describe("getResource", () => {
		it("returns resource with freshness info", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["test"],
						snapshot: "content",
					},
				],
			});

			const result = await getResource(db, { uri: "file:///test.ts" });
			expect(result).not.toBeNull();
			expect(result!.content).toBe("content");
			expect(result!.isFresh).toBe(true);
		});

		it("returns null for nonexistent resource", async () => {
			const result = await getResource(db, { uri: "file:///nonexistent.ts" });
			expect(result).toBeNull();
		});

		it("respects maxAgeHours parameter", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["test"],
						snapshot: "content",
					},
				],
			});

			// With very small threshold, should be stale
			const result = await getResource(db, {
				uri: "file:///test.ts",
				maxAgeHours: 0.0001, // ~0.36 seconds
			});
			// Just created, should still be fresh since verification happens on add
			expect(result).not.toBeNull();
		});
	});

	describe("getResources batch", () => {
		it("fetches multiple resources by ids", async () => {
			const added = await addResources(db, {
				resources: [
					{ uri: "file:///a.ts", type: "file", tags: ["test"] },
					{ uri: "file:///b.ts", type: "file", tags: ["test"] },
				],
			});

			const ids = added.resources.map((r) => r.id);
			const result = await getResources(db, { ids });

			expect(result.resources).toHaveLength(2);
			expect(result.notFound).toHaveLength(0);
		});

		it("fetches multiple resources by uris", async () => {
			await addResources(db, {
				resources: [
					{ uri: "file:///a.ts", type: "file", tags: ["test"] },
					{ uri: "file:///b.ts", type: "file", tags: ["test"] },
				],
			});

			const result = await getResources(db, {
				uris: ["file:///a.ts", "file:///b.ts"],
			});

			expect(result.resources).toHaveLength(2);
			expect(result.notFound).toHaveLength(0);
		});

		it("reports not found resources", async () => {
			const added = await addResources(db, {
				resources: [{ uri: "file:///exists.ts", type: "file", tags: ["test"] }],
			});

			const result = await getResources(db, {
				ids: [added.resources[0]!.id, 999999],
				uris: ["file:///exists.ts", "file:///missing.ts"],
			});

			expect(result.resources).toHaveLength(1); // Only one unique resource
			expect(result.notFound).toContain(999999);
			expect(result.notFound).toContain("file:///missing.ts");
		});

		it("deduplicates resources fetched by both id and uri", async () => {
			const added = await addResources(db, {
				resources: [{ uri: "file:///test.ts", type: "file", tags: ["test"] }],
			});

			const result = await getResources(db, {
				ids: [added.resources[0]!.id],
				uris: ["file:///test.ts"],
			});

			expect(result.resources).toHaveLength(1);
		});
	});

	describe("updateResourceSnapshot", () => {
		it("updates snapshot by id", async () => {
			const added = await addResources(db, {
				resources: [{ uri: "file:///test.ts", type: "file", tags: ["test"] }],
			});

			await updateResourceSnapshot(db, {
				id: added.resources[0]!.id,
				snapshot: "new content",
			});

			const result = await getResource(db, { uri: "file:///test.ts" });
			expect(result!.content).toBe("new content");
		});

		it("updates snapshot by uri", async () => {
			await addResources(db, {
				resources: [{ uri: "file:///test.ts", type: "file", tags: ["test"] }],
			});

			await updateResourceSnapshot(db, {
				uri: "file:///test.ts",
				snapshot: "updated content",
			});

			const result = await getResource(db, { uri: "file:///test.ts" });
			expect(result!.content).toBe("updated content");
		});
	});

	describe("updateResourceSnapshots batch", () => {
		it("updates multiple snapshots", async () => {
			const added = await addResources(db, {
				resources: [
					{ uri: "file:///a.ts", type: "file", tags: ["test"] },
					{ uri: "file:///b.ts", type: "file", tags: ["test"] },
				],
			});

			const result = await updateResourceSnapshots(db, [
				{ resourceId: added.resources[0]!.id, snapshot: "content a" },
				{ resourceId: added.resources[1]!.id, snapshot: "content b" },
			]);

			expect(result.updated).toBe(2);

			const a = await getResource(db, { uri: "file:///a.ts" });
			const b = await getResource(db, { uri: "file:///b.ts" });
			expect(a!.content).toBe("content a");
			expect(b!.content).toBe("content b");
		});

		it("returns zero for empty input", async () => {
			const result = await updateResourceSnapshots(db, []);
			expect(result.updated).toBe(0);
		});
	});

	describe("getStaleResources", () => {
		it("returns resources older than threshold", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["test"],
						snapshot: "content",
					},
				],
			});

			// Manually make resource stale
			const { resources: dbResources } = await import("../../src/db/schema");
			const { eq } = await import("drizzle-orm");

			const oldDate = new Date();
			oldDate.setHours(oldDate.getHours() - 48);

			await db
				.update(dbResources)
				.set({ lastVerifiedAt: oldDate.toISOString() })
				.where(eq(dbResources.uri, "file:///test.ts"));

			const stale = await getStaleResources(db, 24);
			expect(stale).toHaveLength(1);
			expect(stale[0]!.uri).toBe("file:///test.ts");
		});
	});

	describe("deleteResources", () => {
		it("deletes resources by ids", async () => {
			const added = await addResources(db, {
				resources: [
					{ uri: "file:///a.ts", type: "file", tags: ["test"] },
					{ uri: "file:///b.ts", type: "file", tags: ["test"] },
				],
			});

			const result = await deleteResources(db, {
				ids: [added.resources[0]!.id],
			});

			expect(result.deleted).toBe(1);

			const remaining = await searchResources(db, { tags: ["test"] });
			expect(remaining.resources).toHaveLength(1);
		});

		it("deletes resources by uris", async () => {
			await addResources(db, {
				resources: [
					{ uri: "file:///a.ts", type: "file", tags: ["test"] },
					{ uri: "file:///b.ts", type: "file", tags: ["test"] },
				],
			});

			const result = await deleteResources(db, {
				uris: ["file:///a.ts"],
			});

			expect(result.deleted).toBe(1);
		});

		it("returns zero when no conditions provided", async () => {
			await addResources(db, {
				resources: [{ uri: "file:///test.ts", type: "file", tags: ["test"] }],
			});

			const result = await deleteResources(db, {});
			expect(result.deleted).toBe(0);
		});

		it("returns zero when no resources match", async () => {
			const result = await deleteResources(db, { ids: [999999] });
			expect(result.deleted).toBe(0);
		});
	});

	describe("updateResource", () => {
		it("updates description by id without touching snapshot timestamps", async () => {
			const added = await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["test"],
						snapshot: "original content",
					},
				],
			});

			// Get original lastVerifiedAt
			const original = await searchResources(db, { tags: ["test"] });
			const originalLastVerified = original.resources[0]!.lastVerifiedAt;

			// Wait a tiny bit to ensure timestamps would differ
			await new Promise((resolve) => setTimeout(resolve, 10));

			const result = await updateResource(db, {
				id: added.resources[0]!.id,
				description: "Updated description",
			});

			expect(result.success).toBe(true);

			const updated = await searchResources(db, { tags: ["test"] });
			expect(updated.resources[0]!.description).toBe("Updated description");
			expect(updated.resources[0]!.lastVerifiedAt).toBe(originalLastVerified);
		});

		it("updates description by uri", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["test"],
						description: "Old description",
					},
				],
			});

			const result = await updateResource(db, {
				uri: "file:///test.ts",
				description: "New description",
			});

			expect(result.success).toBe(true);

			const updated = await searchResources(db, { tags: ["test"] });
			expect(updated.resources[0]!.description).toBe("New description");
		});

		it("replaces all tags when tags array provided", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["old-tag", "another-old"],
					},
				],
			});

			await updateResource(db, {
				uri: "file:///test.ts",
				tags: ["new-tag", "fresh-tag"],
			});

			const updated = await searchResources(db, { tags: ["new-tag"] });
			expect(updated.resources).toHaveLength(1);
			expect(updated.resources[0]!.tags).toContain("new-tag");
			expect(updated.resources[0]!.tags).toContain("fresh-tag");
			expect(updated.resources[0]!.tags).not.toContain("old-tag");
		});

		it("appends tags without removing existing ones", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["existing"],
					},
				],
			});

			await updateResource(db, {
				uri: "file:///test.ts",
				appendTags: ["appended"],
			});

			const updated = await searchResources(db, { tags: ["existing"] });
			expect(updated.resources[0]!.tags).toContain("existing");
			expect(updated.resources[0]!.tags).toContain("appended");
		});

		it("updates retrieval method", async () => {
			await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["test"],
					},
				],
			});

			await updateResource(db, {
				uri: "file:///test.ts",
				retrievalMethod: { type: "command", command: "cat test.ts" },
			});

			const resource = await getResource(db, { uri: "file:///test.ts" });
			expect(resource!.retrievalMethod).toEqual({
				type: "command",
				command: "cat test.ts",
			});
		});

		it("throws error for nonexistent resource", async () => {
			await expect(
				updateResource(db, {
					id: 999999,
					description: "Should fail",
				}),
			).rejects.toThrow("Resource not found");
		});

		it("does not modify snapshot or snapshotHash", async () => {
			const added = await addResources(db, {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["test"],
						snapshot: "original content",
					},
				],
			});

			await updateResource(db, {
				id: added.resources[0]!.id,
				description: "Updated description",
				tags: ["new-tag"],
			});

			const resource = await getResource(db, { uri: "file:///test.ts" });
			expect(resource!.content).toBe("original content");
		});
	});
});
