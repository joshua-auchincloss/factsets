import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	submitFacts,
	searchFacts,
	verifyFacts,
	deleteFacts,
	updateFact,
	verifyFactsByTags,
} from "../db/operations/facts.js";
import {
	factSubmitInput,
	factSearchInput,
	factVerifyInput,
	factDeleteInput,
	factUpdateInput,
	factVerifyByTagsInput,
} from "../schemas/facts.js";

export function registerFactTools(server: McpServer, db: DB) {
	server.registerTool(
		"submit_facts",
		{
			description:
				"Submit one or more facts to the knowledge base. Facts with matching content will be updated.",
			inputSchema: factSubmitInput,
		},
		async ({ facts }) => {
			const result = await submitFacts(db, { facts });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"search_facts",
		{
			description:
				"Search for facts by tags, content query, verification status, or source type",
			inputSchema: factSearchInput,
		},
		async (params) => {
			const result = await searchFacts(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"verify_facts",
		{
			description: "Mark one or more facts as verified/confirmed",
			inputSchema: factVerifyInput,
		},
		async ({ ids }) => {
			await verifyFacts(db, { ids });
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ success: true, verifiedIds: ids }),
					},
				],
			};
		},
	);

	server.registerTool(
		"delete_facts",
		{
			description: "Delete facts by ID, tags, age, or verification status",
			inputSchema: factDeleteInput,
		},
		async (params) => {
			const deleted = await deleteFacts(db, params);
			return {
				content: [
					{ type: "text", text: JSON.stringify({ success: true, deleted }) },
				],
			};
		},
	);

	server.registerTool(
		"update_fact",
		{
			description:
				"Update an existing fact's content, metadata, source, verification status, or tags. " +
				"Find the fact by ID or exact content match. Supports replacing all tags, " +
				"appending new tags, or removing specific tags.",
			inputSchema: factUpdateInput,
		},
		async (params) => {
			try {
				const result = await updateFact(db, params);
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: error instanceof Error ? error.message : String(error),
							}),
						},
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"verify_facts_by_tags",
		{
			description:
				"Bulk verify all facts that have specified tags. By default, verifies facts with ANY of the tags. " +
				"Set requireAll=true to only verify facts that have ALL specified tags. " +
				"Returns the count and IDs of verified facts.",
			inputSchema: factVerifyByTagsInput,
		},
		async (params) => {
			const result = await verifyFactsByTags(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);
}
