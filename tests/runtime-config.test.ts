import { describe, expect, it, beforeEach } from "bun:test";
import {
	setRuntimeConfig,
	getRuntimeConfig,
	getEffectiveClient,
	getEffectiveSkillsDir,
} from "../src/runtime-config";

describe("runtime-config", () => {
	beforeEach(() => {
		// Reset runtime config before each test
		setRuntimeConfig({});
	});

	describe("setRuntimeConfig / getRuntimeConfig", () => {
		it("sets and gets runtime config", () => {
			setRuntimeConfig({ client: "cursor" });
			expect(getRuntimeConfig()).toEqual({ client: "cursor" });
		});

		it("overwrites previous config", () => {
			setRuntimeConfig({ client: "cursor" });
			setRuntimeConfig({ skillsDir: "./custom" });
			expect(getRuntimeConfig()).toEqual({ skillsDir: "./custom" });
		});

		it("can set both client and skillsDir", () => {
			setRuntimeConfig({ client: "claude", skillsDir: "./skills" });
			expect(getRuntimeConfig()).toEqual({
				client: "claude",
				skillsDir: "./skills",
			});
		});
	});

	describe("getEffectiveClient", () => {
		it("returns runtime config client when set", () => {
			setRuntimeConfig({ client: "cursor" });
			expect(getEffectiveClient("github-copilot")).toBe("cursor");
		});

		it("returns db client when runtime not set", () => {
			expect(getEffectiveClient("claude")).toBe("claude");
		});

		it("returns default when no config", () => {
			expect(getEffectiveClient()).toBe("github-copilot");
		});

		it("returns default for invalid db client", () => {
			expect(getEffectiveClient("invalid-client")).toBe("github-copilot");
		});

		it("returns default for null db client", () => {
			expect(getEffectiveClient(null)).toBe("github-copilot");
		});

		it("runtime config takes precedence over valid db client", () => {
			setRuntimeConfig({ client: "generic" });
			expect(getEffectiveClient("cursor")).toBe("generic");
		});
	});

	describe("getEffectiveSkillsDir", () => {
		it("returns runtime skillsDir when set", () => {
			setRuntimeConfig({ skillsDir: "./my-skills" });
			expect(getEffectiveSkillsDir(".github/prompts/skills", "cursor")).toBe(
				"./my-skills",
			);
		});

		it("returns db skillsDir when runtime not set", () => {
			expect(getEffectiveSkillsDir("./db-skills")).toBe("./db-skills");
		});

		it("derives from effective client when no dir set", () => {
			expect(getEffectiveSkillsDir(null, "cursor")).toBe(
				".cursor/prompts/skills",
			);
		});

		it("uses default client path when nothing set", () => {
			expect(getEffectiveSkillsDir()).toBe(".github/prompts/skills");
		});

		it("runtime skillsDir takes precedence over db skillsDir", () => {
			setRuntimeConfig({ skillsDir: "./runtime-skills" });
			expect(getEffectiveSkillsDir("./db-skills", "cursor")).toBe(
				"./runtime-skills",
			);
		});

		it("db skillsDir takes precedence over client-derived path", () => {
			expect(getEffectiveSkillsDir("./custom-path", "cursor")).toBe(
				"./custom-path",
			);
		});
	});
});
