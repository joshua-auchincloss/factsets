import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
	CallToolResult,
	ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { DB } from "../db/index.js";
import type { z } from "zod";

/**
 * Options for registering a database-backed tool.
 *
 * @template TInput - Zod schema for input validation
 * @template TOutput - Zod schema for output validation
 */
export interface RegisterDbToolOptions<
	TInput extends z.ZodTypeAny,
	TOutput extends z.ZodTypeAny,
> {
	/** Tool name (snake_case) */
	name: string;
	/** Human-readable title for the tool */
	title: string;
	/** Description of what the tool does */
	description: string;
	/** Zod schema for validating input parameters */
	inputSchema: TInput;
	/** Zod schema for describing output format */
	outputSchema: TOutput | z.ZodString;
	/** Whether to output raw plaintext instead of JSON */
	plaintextOutput?: boolean;
	/** Tool behavior annotations (readOnlyHint, destructiveHint, etc.) */
	annotations?: ToolAnnotations;
	/** Handler function that processes the request */
	handler: (db: DB, params: z.infer<TInput>) => Promise<z.infer<TOutput>>;
}

/**
 * Register a tool that wraps a database operation.
 *
 * This utility standardizes tool registration by:
 * - Automatically serializing handler output to JSON
 * - Enforcing input/output schema type safety
 * - Providing consistent error handling patterns
 *
 * @example
 * ```ts
 * registerDbTool(server, db, {
 *   name: "search_facts",
 *   title: "Search Facts",
 *   description: "Search for facts by tags or content",
 *   inputSchema: factSearchInput,
 *   outputSchema: factSearchOutput,
 *   annotations: { readOnlyHint: true },
 *   handler: searchFacts,
 * });
 * ```
 */
export const registerDbTool = <
	TInput extends z.ZodTypeAny,
	TOutput extends z.ZodTypeAny,
>(
	server: McpServer,
	db: DB,
	options: RegisterDbToolOptions<TInput, TOutput>,
) => {
	const {
		name,
		title,
		description,
		inputSchema,
		outputSchema,
		annotations,
		handler,
	} = options;

	// The callback type uses complex conditional types that don't work well with generics,
	// so we need to use a type assertion here
	const callback = async (params: unknown): Promise<CallToolResult> => {
		try {
			const result = await handler(db, params as z.infer<TInput>);
			// When outputSchema is provided, we must return structuredContent
			// along with content for display
			return {
				content: [
					{
						type: "text",
						text: !options.plaintextOutput
							? JSON.stringify(result, null, 2)
							: String(result),
					},
				],
				structuredContent: result as Record<string, unknown>,
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
	};

	return server.registerTool(
		name,
		{
			title,
			description,
			inputSchema,
			outputSchema,
			annotations,
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		callback as any,
	);
};
