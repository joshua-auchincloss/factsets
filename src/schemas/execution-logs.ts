import { z } from "zod";

// Input schemas
export const executionLogSubmitInput = z.object({
	logs: z
		.array(
			z.object({
				command: z
					.string()
					.min(1)
					.describe("The command or action that was executed"),
				workingDirectory: z
					.string()
					.optional()
					.describe("Working directory where the command was run"),
				context: z
					.string()
					.optional()
					.describe(
						"What we were trying to achieve - free text for searchability",
					),
				output: z
					.string()
					.optional()
					.describe("The output (stdout/stderr) from the execution"),
				exitCode: z
					.number()
					.int()
					.optional()
					.describe("Exit code from the command"),
				success: z.boolean().describe("Whether the execution succeeded"),
				durationMs: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("How long the execution took in milliseconds"),
				skillName: z
					.string()
					.optional()
					.describe("The skill this execution relates to"),
				tags: z
					.array(z.string().min(1))
					.optional()
					.describe(
						"Tags for categorization (e.g., test, build, migration, deploy)",
					),
			}),
		)
		.min(1)
		.describe("Array of execution logs to submit"),
});

export const executionLogSearchInput = z.object({
	tags: z
		.array(z.string())
		.optional()
		.describe("Filter by tags (e.g., test, build)"),
	query: z
		.string()
		.optional()
		.describe("Free text search in command, context, and output"),
	success: z.boolean().optional().describe("Filter by success status"),
	skillName: z.string().optional().describe("Filter by related skill name"),
	limit: z
		.number()
		.int()
		.positive()
		.default(50)
		.optional()
		.describe("Maximum results to return"),
	cursor: z.string().optional().describe("Pagination cursor"),
	orderBy: z
		.enum(["recent", "oldest"])
		.default("recent")
		.optional()
		.describe("Sort order"),
});

export const executionLogGetInput = z.object({
	id: z.number().int().positive().describe("ID of the execution log to get"),
});

// Output schemas
export const executionLogOutput = z.object({
	id: z.number(),
	command: z.string(),
	workingDirectory: z.string().nullable(),
	context: z.string().nullable(),
	output: z.string().nullable(),
	exitCode: z.number().nullable(),
	success: z.boolean(),
	durationMs: z.number().nullable(),
	skillName: z.string().nullable(),
	tags: z.array(z.string()),
	createdAt: z.string(),
});

export const executionLogSubmitOutput = z.object({
	created: z.number().describe("Number of logs created"),
	ids: z.array(z.number()).describe("IDs of the created logs"),
});

export const executionLogSearchOutput = z.object({
	logs: z.array(executionLogOutput),
	nextCursor: z.string().optional(),
	suggestedTags: z.array(z.string()).optional(),
});

// Type exports
export type ExecutionLogSubmitInput = z.infer<typeof executionLogSubmitInput>;
export type ExecutionLogSearchInput = z.infer<typeof executionLogSearchInput>;
export type ExecutionLogGetInput = z.infer<typeof executionLogGetInput>;
export type ExecutionLogOutput = z.infer<typeof executionLogOutput>;
export type ExecutionLogSubmitOutput = z.infer<typeof executionLogSubmitOutput>;
export type ExecutionLogSearchOutput = z.infer<typeof executionLogSearchOutput>;
