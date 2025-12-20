import { describe, it, expect, beforeEach } from "bun:test";
import { createTestServer, type TestServer } from "../harness";
import { resetFactories } from "../factories";
import { mkdir, rm } from "node:fs/promises";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const TEST_SKILLS_DIR = "/tmp/factsets-test-skills-prompt-tools";

const extractText = <R extends Partial<CallToolResult>>(result: R): string => {
	const textContent = result.content?.find((c) => c.type === "text");
	return textContent?.type === "text" ? textContent.text : "";
};

const parseResult = <T>(result: Partial<CallToolResult>): T => {
	const text = extractText(result);
	return JSON.parse(text) as T;
};

async function seedData(server: TestServer) {
	// Create facts
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
				verified: false,
			},
			{
				content: "Drizzle ORM is type-safe",
				tags: ["drizzle", "orm", "typescript"],
				verified: true,
			},
		],
	});

	// Create resources
	await server.callTool("add_resources", {
		resources: [
			{
				uri: "file:///project/tsconfig.json",
				type: "file",
				tags: ["typescript", "config"],
				snapshot: '{"compilerOptions": {"strict": true}}',
			},
			{
				uri: "https://docs.example.com/api",
				type: "url",
				tags: ["api", "docs"],
				retrievalMethod: {
					type: "url",
					url: "https://docs.example.com/api",
				},
			},
		],
	});

	// Create skill
	await server.callTool("create_skill", {
		name: "typescript-setup",
		title: "TypeScript Project Setup",
		content:
			"# TypeScript Setup\n\n1. Install TypeScript\n2. Create tsconfig.json\n3. Configure strict mode",
		tags: ["typescript", "setup"],
	});
}

describe("prompt tools", () => {
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
		await seedData(server);
	});

	describe("get_knowledge_context", () => {
		it("builds knowledge context from tags with structured response", async () => {
			const result = await server.callTool("get_knowledge_context", {
				tags: ["typescript"],
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{
				markdown: string;
				tags: string[];
				factsCount: number;
				resourcesCount: number;
				skillsCount: number;
			}>(result);

			expect(data.tags).toEqual(["typescript"]);
			expect(data.factsCount).toBeGreaterThanOrEqual(1);
			expect(data.markdown).toContain("Knowledge Context");
			expect(data.markdown).toContain("typescript");
		});

		it("includes facts in markdown output", async () => {
			const result = await server.callTool("get_knowledge_context", {
				tags: ["typescript"],
			});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("structural typing");
		});

		it("includes resources in markdown output", async () => {
			const result = await server.callTool("get_knowledge_context", {
				tags: ["typescript"],
			});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("tsconfig.json");
		});

		it("includes skills in markdown output", async () => {
			const result = await server.callTool("get_knowledge_context", {
				tags: ["typescript"],
			});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("TypeScript Project Setup");
		});

		it("respects maxFacts limit", async () => {
			const result = await server.callTool("get_knowledge_context", {
				tags: ["typescript"],
				maxFacts: 1,
			});

			const data = parseResult<{ factsCount: number }>(result);
			expect(data.factsCount).toBeLessThanOrEqual(1);
		});

		it("can disable staleness warnings", async () => {
			const result = await server.callTool("get_knowledge_context", {
				tags: ["typescript"],
				includeStalenessWarnings: false,
			});

			const data = parseResult<{ hasStalenessWarnings: boolean }>(result);
			expect(data.hasStalenessWarnings).toBe(false);
		});

		it("handles multiple tags", async () => {
			const result = await server.callTool("get_knowledge_context", {
				tags: ["typescript", "drizzle"],
			});

			const data = parseResult<{ markdown: string; tags: string[] }>(result);
			expect(data.tags).toEqual(["typescript", "drizzle"]);
		});
	});

	describe("build_skill_context", () => {
		it("retrieves skill with structured response", async () => {
			const result = await server.callTool("build_skill_context", {
				name: "typescript-setup",
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{
				markdown: string;
				found: boolean;
				skillName: string;
			}>(result);

			expect(data.found).toBe(true);
			expect(data.skillName).toBe("typescript-setup");
			expect(data.markdown).toContain("TypeScript Project Setup");
		});

		it("returns found=false for nonexistent skill", async () => {
			const result = await server.callTool("build_skill_context", {
				name: "nonexistent-skill",
			});

			const data = parseResult<{ found: boolean; skillName: string }>(result);
			expect(data.found).toBe(false);
			expect(data.skillName).toBe("nonexistent-skill");
		});

		it("includes skill content in markdown", async () => {
			const result = await server.callTool("build_skill_context", {
				name: "typescript-setup",
			});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("Install TypeScript");
			expect(data.markdown).toContain("Create tsconfig.json");
		});

		it("includes tags in markdown", async () => {
			const result = await server.callTool("build_skill_context", {
				name: "typescript-setup",
			});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("typescript");
			expect(data.markdown).toContain("setup");
		});
	});

	describe("get_maintenance_report", () => {
		it("generates maintenance report with summary", async () => {
			const result = await server.callTool("get_maintenance_report", {});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{
				markdown: string;
				summary: {
					totalStale: number;
					resources: number;
					skills: number;
					facts: number;
				};
			}>(result);

			expect(data.summary).toBeDefined();
			expect(typeof data.summary.totalStale).toBe("number");
			expect(data.markdown).toContain("Maintenance Report");
		});

		it("respects maxAgeHours parameter", async () => {
			const result = await server.callTool("get_maintenance_report", {
				maxAgeHours: 24,
			});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("24 hours");
		});

		it("includes summary counts in markdown", async () => {
			const result = await server.callTool("get_maintenance_report", {});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("Summary:");
			expect(data.markdown).toContain("Resources:");
			expect(data.markdown).toContain("Skills:");
		});
	});

	describe("get_refresh_guide", () => {
		it("generates refresh guide for existing resource", async () => {
			// First get a resource ID
			const searchResult = await server.callTool("search_resources", {
				tags: ["api"],
			});
			const resources = parseResult<{
				resources: Array<{ id: number; uri: string }>;
			}>(searchResult);
			const resourceId = resources.resources[0]!.id;

			const result = await server.callTool("get_refresh_guide", {
				resourceId,
			});

			expect(result.isError).toBeFalsy();
			const data = parseResult<{
				markdown: string;
				found: boolean;
				resourceId: number;
			}>(result);

			expect(data.found).toBe(true);
			expect(data.resourceId).toBe(resourceId);
			expect(data.markdown).toContain("Refresh Guide");
		});

		it("returns found=false for nonexistent resource", async () => {
			const result = await server.callTool("get_refresh_guide", {
				resourceId: 99999,
			});

			const data = parseResult<{ found: boolean; resourceId: number }>(result);
			expect(data.found).toBe(false);
			expect(data.resourceId).toBe(99999);
		});

		it("includes retrieval instructions for URL resources", async () => {
			const searchResult = await server.callTool("search_resources", {
				tags: ["api"],
			});
			const resources = parseResult<{
				resources: Array<{ id: number }>;
			}>(searchResult);
			const resourceId = resources.resources[0]!.id;

			const result = await server.callTool("get_refresh_guide", {
				resourceId,
			});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("How to Refresh");
			expect(data.markdown).toContain("Fetch the URL");
		});

		it("includes after-refresh instructions", async () => {
			const searchResult = await server.callTool("search_resources", {
				tags: ["typescript"],
			});
			const resources = parseResult<{
				resources: Array<{ id: number }>;
			}>(searchResult);
			const resourceId = resources.resources[0]!.id;

			const result = await server.callTool("get_refresh_guide", {
				resourceId,
			});

			const data = parseResult<{ markdown: string }>(result);
			expect(data.markdown).toContain("After Refreshing");
			expect(data.markdown).toContain("Review any skills");
		});
	});

	describe("tool vs prompt equivalence", () => {
		it("get_knowledge_context tool produces same content as knowledge_context prompt", async () => {
			const toolResult = await server.callTool("get_knowledge_context", {
				tags: ["typescript"],
			});
			const toolData = parseResult<{ markdown: string }>(toolResult);

			const promptResult = await server.getPrompt("knowledge_context", {
				tags: JSON.stringify(["typescript"]),
			});
			const promptText =
				promptResult.messages[0]?.content &&
				typeof promptResult.messages[0].content === "object" &&
				"text" in promptResult.messages[0].content
					? promptResult.messages[0].content.text
					: "";

			// Both should contain the same core content
			expect(toolData.markdown).toContain("Known Facts");
			expect(promptText).toContain("Known Facts");
		});

		it("get_maintenance_report tool produces same content as maintenance_report prompt", async () => {
			const toolResult = await server.callTool("get_maintenance_report", {
				maxAgeHours: 168,
			});
			const toolData = parseResult<{ markdown: string }>(toolResult);

			const promptResult = await server.getPrompt("maintenance_report", {
				maxAgeHours: "168",
			});
			const promptText =
				promptResult.messages[0]?.content &&
				typeof promptResult.messages[0].content === "object" &&
				"text" in promptResult.messages[0].content
					? promptResult.messages[0].content.text
					: "";

			// Both should contain maintenance report header
			expect(toolData.markdown).toContain("Maintenance Report");
			expect(promptText).toContain("Maintenance Report");
		});
	});

	describe("static guide tools", () => {
		it("get_agent_guide returns the agent workflow guide", async () => {
			const result = await server.callTool("get_agent_guide", {});

			expect(result.isError).toBeFalsy();
			const text = extractText(result);

			// Should contain key sections from facts-agent-flow.md
			expect(text).toContain("Factsets Agent Workflow");
			expect(text).toContain("Workflow Phases");
			expect(text).toContain("Discovery");
			expect(text).toContain("Contribution");
			expect(text).toContain("Maintenance");
		});

		it("get_factsets_concept returns the conceptual overview", async () => {
			const result = await server.callTool("get_factsets_concept", {});

			expect(result.isError).toBeFalsy();
			const text = extractText(result);

			// Should contain key sections from concept.md
			expect(text).toContain("Factsets");
			expect(text).toContain("Core Concepts");
			expect(text).toContain("Facts");
			expect(text).toContain("Resources");
			expect(text).toContain("Skills");
		});

		it("get_agent_guide matches agent_guide prompt content", async () => {
			const toolResult = await server.callTool("get_agent_guide", {});
			const toolText = extractText(toolResult);

			const promptResult = await server.getPrompt("agent_guide", {});
			const promptText =
				promptResult.messages[0]?.content &&
				typeof promptResult.messages[0].content === "object" &&
				"text" in promptResult.messages[0].content
					? promptResult.messages[0].content.text
					: "";

			// Both should return identical content
			expect(toolText).toBe(promptText);
		});

		it("get_factsets_concept matches concept prompt content", async () => {
			const toolResult = await server.callTool("get_factsets_concept", {});
			const toolText = extractText(toolResult);

			const promptResult = await server.getPrompt("concept", {});
			const promptText =
				promptResult.messages[0]?.content &&
				typeof promptResult.messages[0].content === "object" &&
				"text" in promptResult.messages[0].content
					? promptResult.messages[0].content.text
					: "";

			// Both should return identical content
			expect(toolText).toBe(promptText);
		});
	});
});
