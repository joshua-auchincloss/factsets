import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	checkStale,
	markResourcesRefreshed,
} from "../db/operations/staleness.js";
import { checkStaleInput } from "../schemas/context.js";
import { z } from "zod";

const markRefreshedInput = z.object({
	ids: z
		.array(z.number().int().positive())
		.min(1)
		.describe("Resource IDs to mark as refreshed"),
});

export function registerContextTools(server: McpServer, db: DB) {
	server.registerTool(
		"check_stale",
		{
			description:
				"Check for stale resources, skills with changed dependencies, and unverified facts. Returns retrieval methods for stale resources so you can refresh them.",
			inputSchema: checkStaleInput,
		},
		async (params) => {
			const result = await checkStale(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"mark_resources_refreshed",
		{
			description:
				"Mark resources as refreshed after you have verified their content is still valid",
			inputSchema: markRefreshedInput,
		},
		async ({ ids }) => {
			const result = await markResourcesRefreshed(db, ids);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);
}
