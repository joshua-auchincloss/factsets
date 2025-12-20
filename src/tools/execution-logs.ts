import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	submitExecutionLogs,
	searchExecutionLogs,
	getExecutionLog,
} from "../db/operations/execution-logs.js";
import {
	executionLogSubmitInput,
	executionLogSearchInput,
	executionLogGetInput,
} from "../schemas/execution-logs.js";

export function registerExecutionLogTools(server: McpServer, db: DB) {
	server.registerTool(
		"submit_execution_logs",
		{
			description:
				"Record execution logs for commands, tests, builds, or any actions. " +
				"Captures command, output, success status, and tags for future reference. " +
				"Use this to build institutional memory of what commands work for this project.",
			inputSchema: executionLogSubmitInput,
		},
		async ({ logs }) => {
			const result = await submitExecutionLogs(db, { logs });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"search_execution_logs",
		{
			description:
				"Search execution history by tags, free text query, or success status. " +
				"Find what commands were run, what worked, and learn from past experiments. " +
				"Query searches across command, context, and output fields.",
			inputSchema: executionLogSearchInput,
		},
		async (params) => {
			const result = await searchExecutionLogs(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"get_execution_log",
		{
			description:
				"Get a specific execution log by ID to see full details including output.",
			inputSchema: executionLogGetInput,
		},
		async (params) => {
			const result = await getExecutionLog(db, params);
			if (!result) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: "Execution log not found" }),
						},
					],
					isError: true,
				};
			}
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);
}
