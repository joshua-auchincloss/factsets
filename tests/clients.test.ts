import { describe, expect, it } from "bun:test";
import { getSkillsDir, isValidClient, DEFAULT_CLIENT } from "../src/clients";

describe("clients", () => {
	describe("getSkillsDir", () => {
		it("returns correct path for github-copilot", () => {
			expect(getSkillsDir("github-copilot")).toBe(".github/prompts/skills");
		});

		it("returns correct path for cursor", () => {
			expect(getSkillsDir("cursor")).toBe(".cursor/prompts/skills");
		});

		it("returns correct path for claude", () => {
			expect(getSkillsDir("claude")).toBe(".claude/skills");
		});

		it("returns generic path for unknown client", () => {
			expect(getSkillsDir("unknown-client")).toBe(".factsets/skills");
		});

		it("returns generic path for empty string", () => {
			expect(getSkillsDir("")).toBe(".factsets/skills");
		});
	});

	describe("isValidClient", () => {
		it("returns true for valid clients", () => {
			expect(isValidClient("github-copilot")).toBe(true);
			expect(isValidClient("cursor")).toBe(true);
			expect(isValidClient("claude")).toBe(true);
			expect(isValidClient("generic")).toBe(true);
		});

		it("returns false for invalid clients", () => {
			expect(isValidClient("invalid")).toBe(false);
			expect(isValidClient("")).toBe(false);
			expect(isValidClient("vscode")).toBe(false);
		});
	});

	describe("DEFAULT_CLIENT", () => {
		it("is github-copilot", () => {
			expect(DEFAULT_CLIENT).toBe("github-copilot");
		});
	});
});
