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

/**
 * Register prompt tools - these are tool versions of the prompts
 * that allow agents to programmatically invoke them and get structured output.
 */
export function registerPromptTools(server: McpServer, db: DB) {
	server.registerTool(
		"get_knowledge_context",
		{
			description:
				"Build a knowledge context from tags. Returns formatted markdown with relevant facts, resources, skills, and staleness warnings. Use this to gather context before working on a task.",
			inputSchema: knowledgeContextInput,
		},
		async (params) => {
			const result = await generateKnowledgeContext(db, params);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								markdown: result.markdown,
								...result.data,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"build_skill_context",
		{
			description:
				"Build formatted context for a skill including its full content, tags, references, and optionally hydrated referenced skills. Returns markdown suitable for agent consumption.",
			inputSchema: recallSkillInput,
		},
		async (params) => {
			const result = await generateRecallSkill(db, params);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								markdown: result.markdown,
								found: result.found,
								skillName: result.skillName,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"get_maintenance_report",
		{
			description:
				"Generate a maintenance report showing stale resources, skills with changed dependencies, and unverified facts. Use this to identify knowledge base items that need attention.",
			inputSchema: maintenanceReportInput,
		},
		async (params) => {
			const result = await generateMaintenanceReport(db, params);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								markdown: result.markdown,
								summary: result.summary,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"get_refresh_guide",
		{
			description:
				"Get step-by-step instructions for refreshing a specific resource. Returns guidance on how to fetch new content based on the resource's retrieval method.",
			inputSchema: refreshGuideInput,
		},
		async (params) => {
			const result = await generateRefreshGuide(db, params);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								markdown: result.markdown,
								found: result.found,
								resourceId: result.resourceId,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);
}
