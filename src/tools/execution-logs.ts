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
	executionLogSubmitOutput,
	executionLogSearchOutput,
	executionLogOutput,
} from "../schemas/execution-logs.js";
import { registerDbTool } from "./utils.js";
import type { McpServerCompat } from "../types.js";

export function registerExecutionLogTools(server: McpServerCompat, db: DB) {
	registerDbTool(server, db, {
		name: "submit_execution_logs",
		title: "Submit Execution Logs",
		description:
			"Record execution logs for commands, tests, builds, or any actions. " +
			"Captures command, output, success status, and tags for future reference. " +
			"Use this to build institutional memory of what commands work for this project. " +
			"Log immediately after running commands - don't batch or delay.",
		inputSchema: executionLogSubmitInput,
		outputSchema: executionLogSubmitOutput,
		annotations: {
			idempotentHint: false,
		},
		handler: submitExecutionLogs,
	});

	registerDbTool(server, db, {
		name: "search_execution_logs",
		title: "Search Execution Logs",
		description:
			"Search execution history by tags, free text query, or success status. " +
			"Find what commands were run, what worked, and learn from past experiments. " +
			"Query searches across command, context, and output fields.",
		inputSchema: executionLogSearchInput,
		outputSchema: executionLogSearchOutput,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true,
		},
		handler: searchExecutionLogs,
	});

	// get_execution_log has special error handling - keep server.registerTool
	server.registerTool(
		"get_execution_log",
		{
			title: "Get Execution Log",
			description:
				"Get a specific execution log by ID to see full details including output.",
			inputSchema: executionLogGetInput,
			outputSchema: executionLogOutput,
			annotations: {
				readOnlyHint: true,
			},
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
				structuredContent: result,
			};
		},
	);
}
