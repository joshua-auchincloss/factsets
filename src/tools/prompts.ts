import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	knowledgeContextInput,
	recallSkillInput,
	maintenanceReportInput,
	refreshGuideInput,
} from "../schemas/prompts.js";
import {
	generateKnowledgeContext,
	generateRecallSkill,
	generateMaintenanceReport,
	generateRefreshGuide,
} from "../prompts/generators.js";
import { z } from "zod";

// Output schemas for prompt tools - match what the generators actually return
const knowledgeContextOutput = z.object({
	markdown: z.string(),
	tags: z.array(z.string()),
	factsCount: z.number(),
	resourcesCount: z.number(),
	skillsCount: z.number(),
	hasStalenessWarnings: z.boolean(),
});

const recallSkillOutput = z.object({
	markdown: z.string(),
	found: z.boolean(),
	skillName: z.string(),
});

const maintenanceReportOutput = z.object({
	markdown: z.string(),
	summary: z.object({
		totalStale: z.number(),
		resources: z.number(),
		skills: z.number(),
		facts: z.number(),
		pendingReview: z.number(),
		incompleteDescriptions: z.number(),
	}),
});

const refreshGuideOutput = z.object({
	markdown: z.string(),
	found: z.boolean(),
	resourceId: z.number(),
});

/**
 * Register prompt tools - these are tool versions of the prompts
 * that allow agents to programmatically invoke them and get structured output.
 */
export function registerPromptTools(server: McpServer, db: DB) {
	server.registerTool(
		"get_knowledge_context",
		{
			title: "Get Knowledge Context",
			description:
				"Build a knowledge context from tags. Returns formatted markdown with relevant facts, resources, skills, and staleness warnings. Use this to gather context before working on a task.",
			inputSchema: knowledgeContextInput,
			outputSchema: knowledgeContextOutput,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (params) => {
			const result = await generateKnowledgeContext(db, params);
			const structuredResult = {
				markdown: result.markdown,
				...result.data,
			};
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(structuredResult, null, 2),
					},
				],
				structuredContent: structuredResult,
			};
		},
	);

	server.registerTool(
		"build_skill_context",
		{
			title: "Build Skill Context",
			description:
				"Build formatted context for a skill including its full content, tags, references, and optionally hydrated referenced skills. Returns markdown suitable for agent consumption.",
			inputSchema: recallSkillInput,
			outputSchema: recallSkillOutput,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (params) => {
			const result = await generateRecallSkill(db, params);
			const structuredResult = {
				markdown: result.markdown,
				found: result.found,
				skillName: result.skillName,
			};
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(structuredResult, null, 2),
					},
				],
				structuredContent: structuredResult,
			};
		},
	);

	server.registerTool(
		"get_maintenance_report",
		{
			title: "Get Maintenance Report",
			description:
				"Generate a maintenance report showing stale resources, skills with changed dependencies, and unverified facts. Use this to identify knowledge base items that need attention.",
			inputSchema: maintenanceReportInput,
			outputSchema: maintenanceReportOutput,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (params) => {
			const result = await generateMaintenanceReport(db, params);
			const structuredResult = {
				markdown: result.markdown,
				summary: result.summary,
			};
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(structuredResult, null, 2),
					},
				],
				structuredContent: structuredResult,
			};
		},
	);

	server.registerTool(
		"get_refresh_guide",
		{
			title: "Get Refresh Guide",
			description:
				"Get step-by-step instructions for refreshing a specific resource. Returns guidance on how to fetch new content based on the resource's retrieval method.",
			inputSchema: refreshGuideInput,
			outputSchema: refreshGuideOutput,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (params) => {
			const result = await generateRefreshGuide(db, params);
			const structuredResult = {
				markdown: result.markdown,
				found: result.found,
				resourceId: result.resourceId,
			};
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(structuredResult, null, 2),
					},
				],
				structuredContent: structuredResult,
			};
		},
	);
}
