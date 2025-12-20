import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import { listTags, createTags } from "../db/operations/tags.js";
import { tagListInput, tagCreateInput } from "../schemas/tags.js";

export function registerTagTools(server: McpServer, db: DB) {
	server.registerTool(
		"list_tags",
		{
			description:
				"List all tags in the knowledge base, optionally filtered by name pattern",
			inputSchema: tagListInput,
		},
		async ({ filter, limit }) => {
			const result = await listTags(db, { filter, limit });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"create_tags",
		{
			description:
				"Create one or more tags for organizing facts, resources, and skills",
			inputSchema: tagCreateInput,
		},
		async ({ tags }) => {
			const result = await createTags(db, { tags });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);
}
