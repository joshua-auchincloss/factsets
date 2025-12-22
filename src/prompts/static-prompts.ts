import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "fs";
import { projectMeta } from "../meta.js";
import { z } from "zod";

type StaticItem = {
	name: string;
	toolName: string;
	description: string;
	filePath: string;
};

const staticItems: StaticItem[] = [
	{
		name: "agent_guide",
		toolName: "get_agent_guide",
		description:
			"Get the Factsets agent workflow guide. CALL THIS FIRST before using other factsets tools. Returns comprehensive instructions on how agents should interact with the knowledge base including discovery, retrieval, contribution, and maintenance workflows. Emphasizes continuous usage on every prompt - not just at session start.",
		filePath: "prompts/facts-agent-flow.md",
	},
	{
		name: "concept",
		toolName: "get_concept_guide",
		description:
			"Get the Factsets conceptual overview explaining the system design, core concepts (facts, resources, skills, tags), and philosophy behind the knowledge management approach. Includes guidance on continuous headless operation.",
		filePath: "prompts/concept.md",
	},
	{
		name: "config",
		toolName: "get_config_guide",
		description:
			"Get the Factsets configuration guide. Explains all available configuration options, their effects on system behavior, and recommended settings for different use cases. Check current config values after calling this.",
		filePath: "prompts/config.md",
	},
	{
		name: "setup",
		toolName: "get_setup_guide",
		description:
			"Get the Factsets integration setup guide. Use this when integrating Factsets into a new project or repository. Provides comprehensive instructions for analyzing the project, migrating existing skills, configuring AGENTS.md, and establishing baseline knowledge. Designed for thorough one-time setup that saves tokens on all future interactions.",
		filePath: "prompts/setup.md",
	},
];

const staticPrompt = (server: McpServer, item: StaticItem, content: string) => {
	// Register as prompt
	server.registerPrompt(item.name, {}, async () => {
		return {
			messages: [
				{
					role: "user",
					content: {
						type: "text",
						text: content,
					},
				},
			],
		};
	});

	// Register as tool for programmatic access
	server.registerTool(
		item.toolName,
		{
			description: item.description,
			inputSchema: z.object({}),
		},
		async () => {
			return {
				content: [
					{
						type: "text",
						text: content,
					},
				],
			};
		},
	);
};

export const registerStaticPrompts = (server: McpServer) => {
	for (const item of staticItems) {
		const content = readFileSync(
			projectMeta.findPath(item.filePath),
		).toString();
		staticPrompt(server, item, content);
	}
};

/** Get the list of available static guides */
export const getStaticGuideNames = () => staticItems.map((i) => i.toolName);
