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
			"Get the Factsets agent workflow guide. CALL THIS FIRST before using other factsets tools. Returns comprehensive instructions on how agents should interact with the knowledge base including discovery, retrieval, contribution, and maintenance workflows.",
		filePath: "prompts/facts-agent-flow.md",
	},
	{
		name: "concept",
		toolName: "get_factsets_concept",
		description:
			"Get the Factsets conceptual overview explaining the system design, core concepts (facts, resources, skills, tags), and philosophy behind the knowledge management approach.",
		filePath: "prompts/concept.md",
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
