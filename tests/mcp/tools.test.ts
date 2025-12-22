import { describe, it, expect, beforeEach } from "bun:test";
import { createTestServer, type TestServer } from "../harness";
import { resetFactories } from "../factories";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { mkdir, rm } from "node:fs/promises";

const TEST_SKILLS_DIR = "/tmp/factsets-test-skills";

const extractText = <R extends Partial<CallToolResult>>(result: R): string => {
	const textContent = result.content?.find((c) => c.type === "text");
	return textContent?.type === "text" ? textContent.text : "";
};

const parseResult = <T>(result: Partial<CallToolResult>): T => {
	const text = extractText(result);
	return JSON.parse(text) as T;
};

describe("mcp tools", () => {
	let server: TestServer;

	beforeEach(async () => {
		resetFactories();
		server = await createTestServer();
		await server.callTool("set_config", {
			key: "skills_dir",
			value: TEST_SKILLS_DIR,
		});
		await rm(TEST_SKILLS_DIR, { recursive: true, force: true });
		await mkdir(TEST_SKILLS_DIR, { recursive: true });
	});

	describe("create_tags", () => {
		it("creates tags with descriptions", async () => {
			const result = await server.callTool("create_tags", {
				tags: [
					{ name: "test-tag", description: "A test tag" },
					{ name: "another-tag", description: "Another tag" },
				],
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ created: number }>(result);
			expect(data.created).toBe(2);
		});

		it("handles duplicate tags gracefully", async () => {
			await server.callTool("create_tags", {
				tags: [{ name: "dupe-tag", description: "First" }],
			});

			const result = await server.callTool("create_tags", {
				tags: [{ name: "dupe-tag", description: "Second" }],
			});

			expect(result.isError).toBeFalsy();
		});
	});

	describe("submit_facts", () => {
		it("submits facts with tags", async () => {
			const result = await server.callTool("submit_facts", {
				facts: [
					{ content: "Test fact 1", tags: ["fact-test"], verified: true },
					{ content: "Test fact 2", tags: ["fact-test"], verified: false },
				],
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ created: number; updated: number }>(result);
			expect(data.created).toBe(2);
		});

		it("auto-creates tags when submitting facts", async () => {
			await server.callTool("submit_facts", {
				facts: [{ content: "Fact with new tag", tags: ["auto-created-tag"] }],
			});

			const tagsResult = await server.callTool("list_tags", {
				filter: "auto-created",
			});
			const tags = parseResult<{ tags: Array<{ name: string }> }>(tagsResult);
			expect(tags.tags.length).toBeGreaterThan(0);
		});
	});

	describe("search_facts", () => {
		it("searches facts by tags", async () => {
			await server.callTool("submit_facts", {
				facts: [
					{ content: "Searchable fact", tags: ["search-tag"] },
					{ content: "Another fact", tags: ["other-tag"] },
				],
			});

			const result = await server.callTool("search_facts", {
				tags: ["search-tag"],
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ facts: Array<{ content: string }> }>(result);
			expect(data.facts).toHaveLength(1);
			expect(data.facts[0]!.content).toBe("Searchable fact");
		});

		it("searches facts by query", async () => {
			await server.callTool("submit_facts", {
				facts: [
					{ content: "TypeScript uses structural typing", tags: ["ts"] },
					{ content: "JavaScript is dynamic", tags: ["js"] },
				],
			});

			const result = await server.callTool("search_facts", {
				query: "structural typing",
			});

			const data = parseResult<{ facts: Array<{ content: string }> }>(result);
			expect(data.facts).toHaveLength(1);
		});
	});

	describe("add_resources", () => {
		it("adds resources with metadata", async () => {
			const result = await server.callTool("add_resources", {
				resources: [
					{
						uri: "file:///test.ts",
						type: "file",
						tags: ["test"],
						snapshot: "const x = 1;",
					},
				],
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ created: number }>(result);
			expect(data.created).toBe(1);
		});

		it("adds resources with retrieval methods", async () => {
			const result = await server.callTool("add_resources", {
				resources: [
					{
						uri: "https://api.example.com/data",
						type: "api",
						tags: ["api"],
						snapshot: "{}",
						retrievalMethod: {
							type: "api",
							url: "https://api.example.com/data",
							headers: { Authorization: "Bearer token" },
						},
					},
				],
			});

			expect(result.isError).toBeFalsy();
		});
	});

	describe("search_resources", () => {
		it("searches resources by tags", async () => {
			await server.callTool("add_resources", {
				resources: [
					{ uri: "file:///a.ts", type: "file", tags: ["search-res"] },
					{ uri: "file:///b.ts", type: "file", tags: ["other-res"] },
				],
			});

			const result = await server.callTool("search_resources", {
				tags: ["search-res"],
			});

			const data = parseResult<{ resources: Array<{ uri: string }> }>(result);
			expect(data.resources).toHaveLength(1);
			expect(data.resources[0]!.uri).toBe("file:///a.ts");
		});

		it("searches resources by type", async () => {
			await server.callTool("add_resources", {
				resources: [
					{ uri: "file:///code.ts", type: "file", tags: ["type-test"] },
					{ uri: "https://example.com", type: "url", tags: ["type-test"] },
				],
			});

			const result = await server.callTool("search_resources", {
				type: "file",
			});

			const data = parseResult<{ resources: Array<{ type: string }> }>(result);
			expect(data.resources.every((r) => r.type === "file")).toBe(true);
		});
	});

	describe("create_skill", () => {
		it("creates a skill with content", async () => {
			const result = await server.callTool("create_skill", {
				name: "test-skill",
				title: "Test Skill",
				content: "# Test Skill\n\nThis is a test.",
				tags: ["test"],
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ name: string }>(result);
			expect(data.name).toBe("test-skill");
		});

		it("creates a skill with references", async () => {
			const factsResult = await server.callTool("submit_facts", {
				facts: [{ content: "Referenced fact", tags: ["ref-test"] }],
			});
			const factsData = parseResult<{ factIds: number[] }>(factsResult);

			const result = await server.callTool("create_skill", {
				name: "referencing-skill",
				title: "Referencing",
				content: "# Referencing",
				tags: ["test"],
				references: { facts: factsData.factIds },
			});

			expect(result.isError).toBeFalsy();
		});
	});

	describe("get_skill", () => {
		it("retrieves skill by name", async () => {
			await server.callTool("create_skill", {
				name: "retrievable-skill",
				title: "Retrievable",
				content: "# Content",
				tags: ["get-test"],
			});

			const result = await server.callTool("get_skill", {
				name: "retrievable-skill",
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ title: string; content: string }>(result);
			expect(data.title).toBe("Retrievable");
			expect(data.content).toContain("# Content");
		});

		it("returns error for nonexistent skill", async () => {
			const result = await server.callTool("get_skill", {
				name: "nonexistent",
			});

			expect(result.isError).toBe(true);
			const data = parseResult<{ error: string }>(result);
			expect(data.error).toBe("Skill not found");
		});
	});

	describe("check_stale", () => {
		it("returns staleness summary", async () => {
			const result = await server.callTool("check_stale", {
				maxAgeHours: 168,
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ summary: { totalStale: number } }>(result);
			expect(data.summary).toHaveProperty("totalStale");
		});
	});

	describe("list_tags", () => {
		it("lists all tags", async () => {
			await server.callTool("create_tags", {
				tags: [
					{ name: "list-test-a", description: "A" },
					{ name: "list-test-b", description: "B" },
				],
			});

			const result = await server.callTool("list_tags", {});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ tags: Array<{ name: string }> }>(result);
			expect(data.tags.length).toBeGreaterThanOrEqual(2);
		});

		it("filters tags by pattern", async () => {
			await server.callTool("create_tags", {
				tags: [
					{ name: "filter-match", description: "Match" },
					{ name: "no-match", description: "No" },
				],
			});

			const result = await server.callTool("list_tags", {
				filter: "filter",
			});

			const data = parseResult<{ tags: Array<{ name: string }> }>(result);
			expect(data.tags.every((t) => t.name.includes("filter"))).toBe(true);
		});
	});

	describe("update_fact", () => {
		it("updates fact by id", async () => {
			// Create a fact first
			await server.callTool("submit_facts", {
				facts: [
					{
						content: "Original content for update test",
						tags: ["update-test"],
					},
				],
			});

			// Search for the fact to get its ID
			const searchResult = await server.callTool("search_facts", {
				tags: ["update-test"],
			});
			const searchData = parseResult<{
				facts: Array<{ id: number; content: string }>;
			}>(searchResult);
			const factId = searchData.facts[0].id;

			// Update the fact
			const updateResult = await server.callTool("update_fact", {
				id: factId,
				updates: {
					content: "Updated content",
					verified: true,
				},
			});

			expect(updateResult.isError).toBeFalsy();
			const updateData = parseResult<{
				success: boolean;
				id: number;
				content: string;
			}>(updateResult);
			expect(updateData.success).toBe(true);
			expect(updateData.content).toBe("Updated content");
		});

		it("updates fact by content match", async () => {
			const originalContent = "Content to match for update";
			await server.callTool("submit_facts", {
				facts: [{ content: originalContent, tags: ["match-test"] }],
			});

			const updateResult = await server.callTool("update_fact", {
				contentMatch: originalContent,
				updates: {
					source: "new-source",
					sourceType: "documentation",
				},
			});

			console.log(updateResult);

			expect(updateResult.isError).toBeFalsy();
			const updateData = parseResult<{ success: boolean }>(updateResult);
			expect(updateData.success).toBe(true);
		});

		it("appends tags without removing existing", async () => {
			await server.callTool("submit_facts", {
				facts: [
					{ content: "Fact with tags to append", tags: ["existing-tag"] },
				],
			});

			const searchResult = await server.callTool("search_facts", {
				tags: ["existing-tag"],
			});
			const searchData = parseResult<{
				facts: Array<{ id: number }>;
			}>(searchResult);
			const factId = searchData.facts[0].id;

			const updateResult = await server.callTool("update_fact", {
				id: factId,
				updates: {
					appendTags: ["new-tag-1", "new-tag-2"],
				},
			});

			expect(updateResult.isError).toBeFalsy();
			const updateData = parseResult<{
				success: boolean;
				tagsAdded: string[];
			}>(updateResult);
			expect(updateData.tagsAdded).toContain("new-tag-1");
			expect(updateData.tagsAdded).toContain("new-tag-2");
		});

		it("removes specific tags", async () => {
			await server.callTool("submit_facts", {
				facts: [
					{
						content: "Fact with tags to remove",
						tags: ["keep-me", "remove-me"],
					},
				],
			});

			const searchResult = await server.callTool("search_facts", {
				query: "tags to remove",
			});
			const searchData = parseResult<{
				facts: Array<{ id: number }>;
			}>(searchResult);
			const factId = searchData.facts[0].id;

			const updateResult = await server.callTool("update_fact", {
				id: factId,
				updates: {
					removeTags: ["remove-me"],
				},
			});

			expect(updateResult.isError).toBeFalsy();
			const updateData = parseResult<{
				success: boolean;
				tagsRemoved: string[];
			}>(updateResult);
			expect(updateData.tagsRemoved).toContain("remove-me");
		});

		it("returns error for nonexistent fact", async () => {
			const result = await server.callTool("update_fact", {
				id: 999999,
				updates: { content: "new" },
			});

			expect(result.isError).toBe(true);
			const data = parseResult<{ success: boolean; error: string }>(result);
			expect(data.success).toBe(false);
			expect(data.error).toContain("not found");
		});
	});

	describe("verify_facts_by_tags", () => {
		it("verifies all facts with any of the specified tags", async () => {
			await server.callTool("submit_facts", {
				facts: [
					{ content: "Fact 1 for bulk verify", tags: ["bulk-verify-a"] },
					{ content: "Fact 2 for bulk verify", tags: ["bulk-verify-b"] },
					{ content: "Fact 3 not matching", tags: ["other-tag"] },
				],
			});

			const result = await server.callTool("verify_facts_by_tags", {
				tags: ["bulk-verify-a", "bulk-verify-b"],
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ verified: number; factIds: number[] }>(result);
			expect(data.verified).toBe(2);
			expect(data.factIds.length).toBe(2);
		});

		it("verifies only facts with ALL specified tags when requireAll is true", async () => {
			await server.callTool("submit_facts", {
				facts: [
					{ content: "Has both tags", tags: ["tag-x", "tag-y"] },
					{ content: "Has only one tag", tags: ["tag-x"] },
				],
			});

			const result = await server.callTool("verify_facts_by_tags", {
				tags: ["tag-x", "tag-y"],
				requireAll: true,
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ verified: number; factIds: number[] }>(result);
			expect(data.verified).toBe(1);
		});

		it("returns zero when no facts match tags", async () => {
			const result = await server.callTool("verify_facts_by_tags", {
				tags: ["nonexistent-tag-xyz"],
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{ verified: number; factIds: number[] }>(result);
			expect(data.verified).toBe(0);
			expect(data.factIds).toEqual([]);
		});
	});
});
