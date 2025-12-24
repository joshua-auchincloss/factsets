import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServerCompat } from "../types.js";
import type {
	AnySchema,
	ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";

export type CapabilitiesCollector = McpServerCompat & {
	tools: {
		name: string;
		title: string;
		description: string;
		inputSchema: AnySchema | ZodRawShapeCompat | undefined;
		outputSchema: AnySchema | ZodRawShapeCompat | undefined;
	}[];
	prompts: {
		name: string;
		title: string;
		description: string;
		argsSchema: ZodRawShapeCompat | undefined;
	}[];
};

const getCapabilitiesCollector = (
	rootServer: McpServer,
): CapabilitiesCollector => {
	const collector: Pick<CapabilitiesCollector, "tools" | "prompts"> = {
		tools: [],
		prompts: [],
	};

	const registerPrompt: McpServerCompat["registerPrompt"] = (
		name,
		config,
		cb,
	) => {
		collector.prompts?.push({
			name,
			title: config.title || name,
			description: config.description || "",
			argsSchema: config.argsSchema,
		});
		return rootServer.registerPrompt(name, config, cb);
	};

	const registerTool: McpServerCompat["registerTool"] = (name, config, cb) => {
		collector.tools?.push({
			name,
			title: config.title || name,
			description: config.description || "",
			inputSchema: config.inputSchema,
			outputSchema: config.outputSchema,
		});
		return rootServer.registerTool(name, config, cb);
	};

	return {
		...collector,
		registerPrompt,
		registerTool,
	};
};

export { getCapabilitiesCollector };
