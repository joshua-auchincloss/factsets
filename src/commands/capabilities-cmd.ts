import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommandHandler } from "./types.js";
import {
	getCapabilitiesCollector,
	type CapabilitiesCollector,
} from "./capabilities.js";
import serverJson from "../../server.json" with { type: "json" };
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import { register } from "./mcp-server.js";

type Handler = CommandHandler<"capabilities">;

function schemaToJson(schema: unknown): object | undefined {
	if (!schema) return undefined;
	try {
		// Handle Zod schemas
		if (schema && typeof schema === "object" && "_def" in schema) {
			return zodToJsonSchema(schema as ZodTypeAny, { target: "openApi3" });
		}
		// Already a plain object (ZodRawShapeCompat case)
		if (typeof schema === "object") {
			// Convert shape object to JSON schema
			const shape = schema as Record<string, unknown>;
			const properties: Record<string, object> = {};
			for (const [key, value] of Object.entries(shape)) {
				if (value && typeof value === "object" && "_def" in value) {
					properties[key] = zodToJsonSchema(value as ZodTypeAny, {
						target: "openApi3",
					});
				}
			}
			return Object.keys(properties).length > 0
				? { type: "object", properties }
				: undefined;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function formatToolMarkdown(
	tool: CapabilitiesCollector["tools"][number],
): string {
	const lines: string[] = [];
	lines.push(`### \`${tool.name}\``);
	lines.push("");
	if (tool.title && tool.title !== tool.name) {
		lines.push(`**Title:** ${tool.title}`);
		lines.push("");
	}
	if (tool.description) {
		lines.push(tool.description);
		lines.push("");
	}

	const inputJson = schemaToJson(tool.inputSchema);
	if (inputJson) {
		lines.push("**Input Schema:**");
		lines.push("```json");
		lines.push(JSON.stringify(inputJson, null, 2));
		lines.push("```");
		lines.push("");
	}

	const outputJson = schemaToJson(tool.outputSchema);
	if (outputJson) {
		lines.push("**Output Schema:**");
		lines.push("```json");
		lines.push(JSON.stringify(outputJson, null, 2));
		lines.push("```");
		lines.push("");
	}

	return lines.join("\n");
}

function formatPromptMarkdown(
	prompt: CapabilitiesCollector["prompts"][number],
): string {
	const lines: string[] = [];
	lines.push(`### \`${prompt.name}\``);
	lines.push("");
	if (prompt.title && prompt.title !== prompt.name) {
		lines.push(`**Title:** ${prompt.title}`);
	}
	lines.push("");
	if (prompt.description) {
		lines.push(prompt.description);
		lines.push("");
	}

	const argsJson = schemaToJson(prompt.argsSchema);
	if (argsJson) {
		lines.push("**Arguments Schema:**");
		lines.push("```json");
		lines.push(JSON.stringify(argsJson, null, 2));
		lines.push("```");
		lines.push("");
	}

	return lines.join("\n");
}

function formatMarkdown(collector: CapabilitiesCollector): string {
	const lines: string[] = [];

	lines.push(`# ${serverJson.title}`);
	lines.push("");
	lines.push(`> ${serverJson.description}`);
	lines.push("");
	lines.push(`**Version:** ${serverJson.version}`);
	lines.push("");

	// Tools section
	lines.push("## Tools");
	lines.push("");
	lines.push(`Total: ${collector.tools.length} tools`);
	lines.push("");

	for (const tool of collector.tools) {
		lines.push(formatToolMarkdown(tool));
	}

	// Prompts section
	lines.push("## Prompts");
	lines.push("");
	lines.push(`Total: ${collector.prompts.length} prompts`);
	lines.push("");

	for (const prompt of collector.prompts) {
		lines.push(formatPromptMarkdown(prompt));
	}

	return lines.join("\n");
}

function formatJson(collector: CapabilitiesCollector): object {
	return {
		name: serverJson.name,
		title: serverJson.title,
		description: serverJson.description,
		version: serverJson.version,
		repository: serverJson.repository.url,
		tools: collector.tools.map((tool) => ({
			name: tool.name,
			title: tool.title,
			description: tool.description,
			inputSchema: schemaToJson(tool.inputSchema),
			outputSchema: schemaToJson(tool.outputSchema),
		})),
		prompts: collector.prompts.map((prompt) => ({
			name: prompt.name,
			title: prompt.title,
			description: prompt.description,
			argsSchema: schemaToJson(prompt.argsSchema),
		})),
	};
}

export const capabilitiesHandler: Handler = async (config) => {
	// Create a dummy server just for registration
	const server = new McpServer({
		name: serverJson.name,
		title: serverJson.title,
		description: serverJson.description,
		version: serverJson.version,
	});

	const collector = getCapabilitiesCollector(server);

	// Register all tools and prompts using the collector
	// We pass a null db since we're just collecting metadata
	const nullDb = null as never;

	register(collector, nullDb);

	// Output based on format
	if (config.format === "json") {
		console.log(JSON.stringify(formatJson(collector), null, 2));
	} else {
		console.log(formatMarkdown(collector));
	}
};
