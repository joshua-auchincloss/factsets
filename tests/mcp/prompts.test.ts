import { describe, it, expect, beforeEach } from "bun:test";
import { createTestServer, type TestServer } from "../harness";
import { resetFactories } from "../factories";
import { mkdir, rm } from "node:fs/promises";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

const TEST_SKILLS_DIR = "/tmp/factsets-test-skills";

const extractText = (result: GetPromptResult): string => {
	const textContent = result.messages[0]?.content;
	if (typeof textContent === "string") return textContent;
	if (Array.isArray(textContent)) {
		const text = textContent.find((c) => c.type === "text");
		return text?.type === "text" ? text.text : "";
	}
	if (
		textContent &&
		typeof textContent === "object" &&
		"type" in textContent &&
		textContent.type === "text"
	) {
		return textContent.text;
	}
	return "";
};

async function seedViaTools(server: TestServer) {
	await server.callTool("submit_facts", {
		facts: [
			{
				content: "TypeScript uses structural typing",
				tags: ["typescript", "types"],
				verified: true,
			},
			{
				content: "Bun is a fast JavaScript runtime",
				tags: ["bun", "runtime"],
				verified: true,
			},
		],
	});
	await server.callTool("add_resources", {
		resources: [
			{
				uri: "file:///project/tsconfig.json",
				type: "file",
				tags: ["typescript", "config"],
				snapshot: '{"compilerOptions": {"strict": true}}',
			},
		],
	});
	await server.callTool("create_skill", {
		name: "typescript-setup",
		title: "TypeScript Project Setup",
		content:
			"# TypeScript Setup\n\n1. Install TypeScript\n2. Create tsconfig.json",
		tags: ["typescript", "setup"],
	});
}

describe("mcp prompts", () => {
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
		await seedViaTools(server);
	});

	describe("knowledge_context", () => {
		it("generates context prompt for given tags", async () => {
			const result = await server.getPrompt("knowledge_context", {
				tags: JSON.stringify(["typescript"]),
			});

			expect(result).toBeDefined();
			expect(result.messages).toHaveLength(1);

			const text = extractText(result);
			expect(text.toLowerCase()).toContain("typescript");
		});

		it("includes relevant facts in context", async () => {
			await server.callTool("submit_facts", {
				facts: [
					{
						content: "Custom fact for context test",
						tags: ["context-test-tag"],
					},
				],
			});

			const result = await server.getPrompt("knowledge_context", {
				tags: JSON.stringify(["context-test-tag"]),
			});

			const text = extractText(result);
			expect(text).toContain("Custom fact for context test");
		});

		it("includes relevant resources in context", async () => {
			await server.callTool("add_resources", {
				resources: [
					{
						uri: "file:///context-resource.ts",
						type: "file",
						tags: ["context-res-tag"],
						snapshot: "export const contextValue = 42;",
					},
				],
			});

			const result = await server.getPrompt("knowledge_context", {
				tags: JSON.stringify(["context-res-tag"]),
			});

			const text = extractText(result);
			expect(text).toContain("context-resource.ts");
		});

		it("includes skills in context", async () => {
			await server.callTool("create_skill", {
				name: "context-skill",
				title: "Context Skill",
				content: "# Context Skill\n\nThis skill provides context.",
				tags: ["context-skill-tag"],
			});

			const result = await server.getPrompt("knowledge_context", {
				tags: JSON.stringify(["context-skill-tag"]),
			});

			const text = extractText(result);
			expect(text).toContain("Context Skill");
		});

		it("handles multiple tags as JSON array", async () => {
			await server.callTool("submit_facts", {
				facts: [
					{ content: "Multi tag fact A", tags: ["multi-tag-a"] },
					{ content: "Multi tag fact B", tags: ["multi-tag-b"] },
				],
			});

			const result = await server.getPrompt("knowledge_context", {
				tags: JSON.stringify(["multi-tag-a", "multi-tag-b"]),
			});

			const text = extractText(result);
			expect(text).toContain("Multi tag fact A");
			expect(text).toContain("Multi tag fact B");
		});
	});

	describe("maintenance_report", () => {
		it("generates maintenance report", async () => {
			const result = await server.getPrompt("maintenance_report", {
				maxAgeHours: "168",
			});

			expect(result).toBeDefined();
			expect(result.messages).toHaveLength(1);

			const text = extractText(result);
			expect(text.toLowerCase()).toContain("maintenance");
		});

		it("includes stale resource information", async () => {
			await server.callTool("add_resources", {
				resources: [
					{
						uri: "file:///stale-for-report.ts",
						type: "file",
						tags: ["stale-report"],
					},
				],
			});

			const result = await server.getPrompt("maintenance_report", {
				maxAgeHours: "0",
			});

			const text = extractText(result);
			expect(text).toBeDefined();
		});

		it("includes staleness summary counts", async () => {
			const result = await server.getPrompt("maintenance_report", {
				maxAgeHours: "168",
			});

			const text = extractText(result);
			expect(text).toMatch(/\d+/);
		});

		it("respects custom maxAgeHours parameter", async () => {
			const shortResult = await server.getPrompt("maintenance_report", {
				maxAgeHours: "24",
			});

			const longResult = await server.getPrompt("maintenance_report", {
				maxAgeHours: "8760",
			});

			expect(shortResult).toBeDefined();
			expect(longResult).toBeDefined();
		});
	});

	describe("recall_skill", () => {
		it("recalls skill by name", async () => {
			const result = await server.getPrompt("recall_skill", {
				name: "typescript-setup",
			});

			expect(result).toBeDefined();
			const text = extractText(result);
			expect(text).toContain("TypeScript Project Setup");
			expect(text).toContain("Install TypeScript");
		});

		it("returns not found for nonexistent skill", async () => {
			const result = await server.getPrompt("recall_skill", {
				name: "nonexistent-skill",
			});

			expect(result).toBeDefined();
			const text = extractText(result);
			expect(text).toContain("not found");
		});
	});

	describe("prompt edge cases", () => {
		it("handles empty tags array", async () => {
			const result = await server.getPrompt("knowledge_context", {
				tags: JSON.stringify([]),
			});

			expect(result).toBeDefined();
			expect(result.messages).toHaveLength(1);
		});

		it("handles special characters in tags", async () => {
			const result = await server.getPrompt("knowledge_context", {
				tags: JSON.stringify(["test-tag", "another_tag"]),
			});

			expect(result).toBeDefined();
		});

		it("uses default maxAgeHours when not provided", async () => {
			const result = await server.getPrompt("maintenance_report", {});

			expect(result).toBeDefined();
			const text = extractText(result);
			expect(text).toContain("168 hours");
		});
	});
});
