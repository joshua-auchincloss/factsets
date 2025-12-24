import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface McpServerCompat {
	registerTool: typeof McpServer.prototype.registerTool;
	registerPrompt: typeof McpServer.prototype.registerPrompt;
}
