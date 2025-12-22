import { describe, expect, it } from "bun:test";
import {
	expandTagsWithSynonyms,
	expandTagsWithHierarchy,
	validateRequiredTagsSync,
	type TagSynonyms,
	type TagHierarchies,
	type RequiredTags,
} from "../../src/db/operations/tag-relationships";

describe("tag-relationships", () => {
	describe("expandTagsWithSynonyms", () => {
		const synonyms: TagSynonyms = {
			db: "database",
			ts: "typescript",
			js: "javascript",
		};

		it("expands alias to canonical", () => {
			const result = expandTagsWithSynonyms(["db"], synonyms);
			expect(result).toContain("db");
			expect(result).toContain("database");
		});

		it("expands canonical to alias (bidirectional)", () => {
			const result = expandTagsWithSynonyms(["database"], synonyms);
			expect(result).toContain("database");
			expect(result).toContain("db");
		});

		it("handles multiple tags", () => {
			const result = expandTagsWithSynonyms(["db", "ts"], synonyms);
			expect(result).toContain("db");
			expect(result).toContain("database");
			expect(result).toContain("ts");
			expect(result).toContain("typescript");
		});

		it("returns original tags unchanged when no synonyms match", () => {
			const result = expandTagsWithSynonyms(["unknown"], synonyms);
			expect(result).toEqual(["unknown"]);
		});

		it("deduplicates when both alias and canonical provided", () => {
			const result = expandTagsWithSynonyms(["db", "database"], synonyms);
			expect(result.filter((t) => t === "db").length).toBe(1);
			expect(result.filter((t) => t === "database").length).toBe(1);
		});

		it("handles empty input", () => {
			const result = expandTagsWithSynonyms([], synonyms);
			expect(result).toEqual([]);
		});

		it("handles empty synonyms", () => {
			const result = expandTagsWithSynonyms(["db", "ts"], {});
			expect(result).toEqual(["db", "ts"]);
		});
	});

	describe("expandTagsWithHierarchy", () => {
		const hierarchies: TagHierarchies = {
			"mcp-tools": "mcp",
			"mcp-prompts": "mcp",
			drizzle: "database",
			sqlite: "database",
		};

		it("expands parent to include children", () => {
			const result = expandTagsWithHierarchy(["mcp"], hierarchies);
			expect(result).toContain("mcp");
			expect(result).toContain("mcp-tools");
			expect(result).toContain("mcp-prompts");
		});

		it("does not expand children to parent", () => {
			const result = expandTagsWithHierarchy(["mcp-tools"], hierarchies);
			expect(result).toContain("mcp-tools");
			expect(result).not.toContain("mcp");
		});

		it("handles multiple parent tags", () => {
			const result = expandTagsWithHierarchy(["mcp", "database"], hierarchies);
			expect(result).toContain("mcp");
			expect(result).toContain("mcp-tools");
			expect(result).toContain("mcp-prompts");
			expect(result).toContain("database");
			expect(result).toContain("drizzle");
			expect(result).toContain("sqlite");
		});

		it("handles multi-level hierarchies", () => {
			const deepHierarchy: TagHierarchies = {
				"level-2": "level-1",
				"level-3": "level-2",
			};
			const result = expandTagsWithHierarchy(["level-1"], deepHierarchy);
			expect(result).toContain("level-1");
			expect(result).toContain("level-2");
			expect(result).toContain("level-3");
		});

		it("handles empty input", () => {
			const result = expandTagsWithHierarchy([], hierarchies);
			expect(result).toEqual([]);
		});

		it("handles empty hierarchies", () => {
			const result = expandTagsWithHierarchy(["mcp"], {});
			expect(result).toEqual(["mcp"]);
		});

		it("returns original tags when no children exist", () => {
			const result = expandTagsWithHierarchy(["unknown"], hierarchies);
			expect(result).toEqual(["unknown"]);
		});
	});

	describe("validateRequiredTagsSync", () => {
		const requiredTags: RequiredTags = {
			facts: [],
			skills: ["workflow"],
			resources: ["factsets*"],
		};

		it("passes when no requirements for entity type", () => {
			const result = validateRequiredTagsSync(
				"facts",
				["any", "tags"],
				requiredTags,
			);
			expect(result.valid).toBe(true);
			expect(result.missing).toEqual([]);
		});

		it("passes when exact match required tag present", () => {
			const result = validateRequiredTagsSync(
				"skills",
				["workflow", "other"],
				requiredTags,
			);
			expect(result.valid).toBe(true);
			expect(result.missing).toEqual([]);
		});

		it("fails when exact match required tag missing", () => {
			const result = validateRequiredTagsSync(
				"skills",
				["other", "tags"],
				requiredTags,
			);
			expect(result.valid).toBe(false);
			expect(result.missing).toContain("workflow");
		});

		it("passes when prefix pattern matches", () => {
			const result = validateRequiredTagsSync(
				"resources",
				["factsets-core", "other"],
				requiredTags,
			);
			expect(result.valid).toBe(true);
		});

		it("fails when prefix pattern does not match", () => {
			const result = validateRequiredTagsSync(
				"resources",
				["other", "tags"],
				requiredTags,
			);
			expect(result.valid).toBe(false);
			expect(result.missing).toContain("factsets*");
		});

		it("handles unknown entity type (no requirements)", () => {
			const result = validateRequiredTagsSync("unknown", ["any"], requiredTags);
			expect(result.valid).toBe(true);
		});

		it("handles empty provided tags", () => {
			const result = validateRequiredTagsSync("skills", [], requiredTags);
			expect(result.valid).toBe(false);
			expect(result.missing).toContain("workflow");
		});

		it("handles empty required tags config", () => {
			const result = validateRequiredTagsSync("skills", ["any"], {});
			expect(result.valid).toBe(true);
		});
	});
});
