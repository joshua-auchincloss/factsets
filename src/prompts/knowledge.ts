import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import { z } from "zod";
import { generateKnowledgeContext, generateRecallSkill } from "./generators.js";

const knowledgeContextArgs = {
	tags: z
		.string()
		.describe(
			'JSON array of tags to build context from, e.g. \'["project", "api"]\'',
		),
	maxFacts: z
		.string()
		.optional()
		.describe("Maximum number of facts to include (default: 50)"),
	maxResources: z
		.string()
		.optional()
		.describe("Maximum number of resources to include (default: 20)"),
	maxSkills: z
		.string()
		.optional()
		.describe("Maximum number of skills to include (default: 10)"),
	includeStalenessWarnings: z
		.string()
		.optional()
		.describe("Include staleness warnings section (true/false, default: true)"),
};

const recallSkillArgs = {
	name: z.string().describe("The name of the skill to recall"),
	includeRefs: z
		.string()
		.optional()
		.describe(
			"Include content of referenced skills (true/false, default: false)",
		),
};

export function registerKnowledgePrompts(server: McpServer, db: DB) {
	server.registerPrompt(
		"knowledge_context",
		{
			description:
				"Build a knowledge context from tags to provide relevant facts, resources, and skills for a task",
			argsSchema: knowledgeContextArgs,
		},
		async ({
			tags,
			maxFacts,
			maxResources,
			maxSkills,
			includeStalenessWarnings,
		}) => {
			let tagList: string[];
			try {
				tagList = JSON.parse(tags);
				if (!Array.isArray(tagList)) {
					throw new Error("Tags must be a JSON array");
				}
			} catch {
				throw new Error(
					'Invalid tags format. Expected JSON array, e.g. \'["project", "api"]\'',
				);
			}

			const result = await generateKnowledgeContext(db, {
				tags: tagList,
				maxFacts: maxFacts ? parseInt(maxFacts, 10) : undefined,
				maxResources: maxResources ? parseInt(maxResources, 10) : undefined,
				maxSkills: maxSkills ? parseInt(maxSkills, 10) : undefined,
				includeStalenessWarnings: includeStalenessWarnings !== "false",
			});

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: result.markdown,
						},
					},
				],
			};
		},
	);

	server.registerPrompt(
		"recall_skill",
		{
			description:
				"Recall a specific skill with all its content and references",
			argsSchema: recallSkillArgs,
		},
		async ({ name, includeRefs }) => {
			const result = await generateRecallSkill(db, {
				name,
				includeRefs: includeRefs === "true",
			});

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: result.markdown,
						},
					},
				],
			};
		},
	);
}
