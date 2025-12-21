import { eq, like, sql, inArray, and, desc, asc, or } from "drizzle-orm";
import type { DB } from "../index.js";
import { executionLogs, executionLogTags, tags } from "../schema.js";
import { getOrCreateTags, incrementTagUsage } from "./tags.js";
import { expandTags } from "./tag-relationships.js";
import { getSearchLimit } from "./config.js";
import { decodeCursor, getNextCursor } from "../../utils/cursor.js";
import type {
	ExecutionLogSubmitInput,
	ExecutionLogSearchInput,
	ExecutionLogGetInput,
	ExecutionLogOutput,
	ExecutionLogSubmitOutput,
	ExecutionLogSearchOutput,
} from "../../schemas/execution-logs.js";

/**
 * Submit one or more execution logs to the knowledge base
 */
export async function submitExecutionLogs(
	db: DB,
	input: ExecutionLogSubmitInput,
): Promise<ExecutionLogSubmitOutput> {
	const ids: number[] = [];

	for (const log of input.logs) {
		// Get or create tags (empty array if none provided)
		const tagMap = await getOrCreateTags(db, log.tags ?? []);

		// Insert the execution log
		const result = await db
			.insert(executionLogs)
			.values({
				command: log.command,
				workingDirectory: log.workingDirectory ?? null,
				context: log.context ?? null,
				output: log.output ?? null,
				exitCode: log.exitCode ?? null,
				success: log.success,
				durationMs: log.durationMs ?? null,
				skillName: log.skillName ?? null,
			})
			.returning({ id: executionLogs.id });

		const logId = result[0]!.id;
		ids.push(logId);

		// Link tags
		if (tagMap.size > 0) {
			const tagLinks = Array.from(tagMap.values()).map((tagId) => ({
				executionLogId: logId,
				tagId,
			}));
			await db.insert(executionLogTags).values(tagLinks);
		}
	}

	return { created: ids.length, ids };
}

/**
 * Search execution logs by tags, query, success status
 */
export async function searchExecutionLogs(
	db: DB,
	input: ExecutionLogSearchInput,
): Promise<ExecutionLogSearchOutput> {
	// Use config-based default limit if not provided
	const configLimit = await getSearchLimit(db, "executionLogs");
	const limit = input.limit ?? configLimit;
	const tagIdsToIncrement: number[] = [];

	// Parse cursor for offset
	let offset = 0;
	if (input.cursor) {
		const cursorData = decodeCursor(input.cursor);
		if (!cursorData) {
			throw new Error("Invalid cursor");
		}
		offset = cursorData.offset;
	}

	// Build conditions array
	const conditions: ReturnType<typeof eq>[] = [];

	// Filter by success
	if (input.success !== undefined) {
		conditions.push(eq(executionLogs.success, input.success));
	}

	// Filter by skill name
	if (input.skillName) {
		conditions.push(eq(executionLogs.skillName, input.skillName));
	}

	// Filter by free text query (search in command, context, output)
	if (input.query) {
		const pattern = `%${input.query}%`;
		conditions.push(
			or(
				like(executionLogs.command, pattern),
				like(executionLogs.context, pattern),
				like(executionLogs.output, pattern),
			) as ReturnType<typeof eq>,
		);
	}

	// Start building query
	let query = db
		.selectDistinct({
			id: executionLogs.id,
			command: executionLogs.command,
			workingDirectory: executionLogs.workingDirectory,
			context: executionLogs.context,
			output: executionLogs.output,
			exitCode: executionLogs.exitCode,
			success: executionLogs.success,
			durationMs: executionLogs.durationMs,
			skillName: executionLogs.skillName,
			createdAt: executionLogs.createdAt,
		})
		.from(executionLogs);

	// Handle tag filtering with expansion
	if (input.tags && input.tags.length > 0) {
		// Expand tags using synonyms and hierarchies from config
		const expandedTags = await expandTags(db, input.tags);

		const tagResults = await db
			.select({ id: tags.id })
			.from(tags)
			.where(inArray(tags.name, expandedTags));

		if (tagResults.length === 0) {
			// No matching tags - return empty with suggestions
			const suggestedTags = await getSuggestedExecutionTags(db, 5);
			return { logs: [], suggestedTags };
		}

		const tagIds = tagResults.map((t) => t.id);
		tagIdsToIncrement.push(...tagIds);

		query = query
			.innerJoin(
				executionLogTags,
				eq(executionLogs.id, executionLogTags.executionLogId),
			)
			.where(
				conditions.length > 0
					? and(inArray(executionLogTags.tagId, tagIds), ...conditions)
					: inArray(executionLogTags.tagId, tagIds),
			) as unknown as typeof query;
	} else if (conditions.length > 0) {
		query = query.where(and(...conditions)) as unknown as typeof query;
	}

	// Apply ordering
	const orderBy = input.orderBy ?? "recent";
	switch (orderBy) {
		case "oldest":
			query = query.orderBy(
				asc(executionLogs.createdAt),
			) as unknown as typeof query;
			break;
		case "recent":
		default:
			query = query.orderBy(
				desc(executionLogs.createdAt),
			) as unknown as typeof query;
			break;
	}

	// Fetch limit + 1 to determine if there are more results
	const results = await query.offset(offset).limit(limit + 1);

	// Check if there are more results
	const hasMore = results.length > limit;
	const pageResults = hasMore ? results.slice(0, limit) : results;

	// Increment tag usage
	if (tagIdsToIncrement.length > 0) {
		await incrementTagUsage(db, tagIdsToIncrement);
	}

	// Enrich with tags
	const logsWithTags: ExecutionLogOutput[] = await Promise.all(
		pageResults.map(async (log) => {
			const logTags = await db
				.select({ name: tags.name })
				.from(executionLogTags)
				.innerJoin(tags, eq(executionLogTags.tagId, tags.id))
				.where(eq(executionLogTags.executionLogId, log.id));

			return {
				...log,
				tags: logTags.map((t) => t.name),
			};
		}),
	);

	// Include suggested tags when results are empty
	if (logsWithTags.length === 0) {
		const suggestedTags = await getSuggestedExecutionTags(db, 5);
		return { logs: [], suggestedTags };
	}

	return {
		logs: logsWithTags,
		nextCursor: getNextCursor(offset, limit, results.length),
	};
}

/**
 * Get a specific execution log by ID
 */
export async function getExecutionLog(
	db: DB,
	input: ExecutionLogGetInput,
): Promise<ExecutionLogOutput | null> {
	const result = await db
		.select({
			id: executionLogs.id,
			command: executionLogs.command,
			workingDirectory: executionLogs.workingDirectory,
			context: executionLogs.context,
			output: executionLogs.output,
			exitCode: executionLogs.exitCode,
			success: executionLogs.success,
			durationMs: executionLogs.durationMs,
			skillName: executionLogs.skillName,
			createdAt: executionLogs.createdAt,
		})
		.from(executionLogs)
		.where(eq(executionLogs.id, input.id))
		.limit(1);

	if (result.length === 0) {
		return null;
	}

	const log = result[0]!;

	// Get tags
	const logTags = await db
		.select({ name: tags.name })
		.from(executionLogTags)
		.innerJoin(tags, eq(executionLogTags.tagId, tags.id))
		.where(eq(executionLogTags.executionLogId, log.id));

	return {
		id: log.id,
		command: log.command,
		workingDirectory: log.workingDirectory,
		context: log.context,
		output: log.output,
		exitCode: log.exitCode,
		success: log.success,
		durationMs: log.durationMs,
		skillName: log.skillName,
		createdAt: log.createdAt,
		tags: logTags.map((t) => t.name),
	};
}

/**
 * Get suggested tags for execution logs (most used in logs)
 */
async function getSuggestedExecutionTags(
	db: DB,
	limit: number,
): Promise<string[]> {
	const result = await db
		.select({
			name: tags.name,
			count: sql<number>`count(${executionLogTags.executionLogId})`,
		})
		.from(tags)
		.innerJoin(executionLogTags, eq(tags.id, executionLogTags.tagId))
		.groupBy(tags.id)
		.orderBy(desc(sql`count(${executionLogTags.executionLogId})`))
		.limit(limit);

	return result.map((r) => r.name);
}
