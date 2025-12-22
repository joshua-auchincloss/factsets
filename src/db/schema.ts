import {
	sqliteTable,
	text,
	integer,
	primaryKey,
	index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Inlined constant to avoid module resolution issues with drizzle-kit
const PLACEHOLDER_DESCRIPTION = "[auto-migrated] Needs description";

export const config = sqliteTable("config", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const tags = sqliteTable("tags", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description").notNull(),
	usageCount: integer("usage_count").default(0).notNull(),
	systemId: text("system_id").unique(),
	createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const facts = sqliteTable(
	"facts",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		content: text("content").notNull(),
		source: text("source"),
		sourceType: text("source_type"),
		verified: integer("verified", { mode: "boolean" }).default(false).notNull(),
		retrievalCount: integer("retrieval_count").default(0).notNull(),
		lastRetrievedAt: text("last_retrieved_at"),
		systemId: text("system_id").unique(),
		systemHash: text("system_hash"),
		createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
		updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
		deletedAt: text("deleted_at"),
	},
	(table) => [
		index("facts_content_idx").on(table.content),
		index("facts_source_type_idx").on(table.sourceType),
		index("facts_deleted_at_idx").on(table.deletedAt),
	],
);

export const factTags = sqliteTable(
	"fact_tags",
	{
		factId: integer("fact_id")
			.notNull()
			.references(() => facts.id, { onDelete: "cascade" }),
		tagId: integer("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.factId, table.tagId] })],
);

export const resources = sqliteTable(
	"resources",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		uri: text("uri").notNull().unique(),
		type: text("type").notNull(),
		description: text("description").default(PLACEHOLDER_DESCRIPTION).notNull(),
		snapshot: text("snapshot"),
		snapshotHash: text("snapshot_hash"),
		retrievalMethod: text("retrieval_method", { mode: "json" }).$type<{
			type: string;
			command?: string;
			url?: string;
			headers?: Record<string, string>;
		}>(),
		lastVerifiedAt: text("last_verified_at"),
		retrievalCount: integer("retrieval_count").default(0).notNull(),
		systemId: text("system_id").unique(),
		systemHash: text("system_hash"),
		createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
		updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
		deletedAt: text("deleted_at"),
	},
	(table) => [
		index("resources_uri_idx").on(table.uri),
		index("resources_type_idx").on(table.type),
		index("resources_deleted_at_idx").on(table.deletedAt),
	],
);

export const resourceTags = sqliteTable(
	"resource_tags",
	{
		resourceId: integer("resource_id")
			.notNull()
			.references(() => resources.id, { onDelete: "cascade" }),
		tagId: integer("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.resourceId, table.tagId] })],
);

export const skills = sqliteTable(
	"skills",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull().unique(),
		title: text("title").notNull(),
		description: text("description").default(PLACEHOLDER_DESCRIPTION).notNull(),
		filePath: text("file_path").notNull(),
		contentHash: text("content_hash"),
		retrievalCount: integer("retrieval_count").default(0).notNull(),
		lastRetrievedAt: text("last_retrieved_at"),
		needsReview: integer("needs_review", { mode: "boolean" })
			.default(false)
			.notNull(),
		systemId: text("system_id").unique(),
		systemHash: text("system_hash"),
		// Optional: execution log that validated this skill (for command-based skills)
		executionLogId: integer("execution_log_id"),
		createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
		updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
		deletedAt: text("deleted_at"),
	},
	(table) => [
		index("skills_name_idx").on(table.name),
		index("skills_deleted_at_idx").on(table.deletedAt),
		index("skills_execution_log_id_idx").on(table.executionLogId),
	],
);

export const skillTags = sqliteTable(
	"skill_tags",
	{
		skillId: integer("skill_id")
			.notNull()
			.references(() => skills.id, { onDelete: "cascade" }),
		tagId: integer("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.skillId, table.tagId] })],
);

export const skillSkills = sqliteTable(
	"skill_skills",
	{
		skillId: integer("skill_id")
			.notNull()
			.references(() => skills.id, { onDelete: "cascade" }),
		referencedSkillId: integer("referenced_skill_id")
			.notNull()
			.references(() => skills.id, { onDelete: "cascade" }),
		relationType: text("relation_type").notNull(),
		createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.skillId, table.referencedSkillId] }),
	],
);

export const skillResources = sqliteTable(
	"skill_resources",
	{
		skillId: integer("skill_id")
			.notNull()
			.references(() => skills.id, { onDelete: "cascade" }),
		resourceId: integer("resource_id")
			.notNull()
			.references(() => resources.id, { onDelete: "cascade" }),
		snapshotHashAtLink: text("snapshot_hash_at_link"),
		createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	},
	(table) => [primaryKey({ columns: [table.skillId, table.resourceId] })],
);

export const skillFacts = sqliteTable(
	"skill_facts",
	{
		skillId: integer("skill_id")
			.notNull()
			.references(() => skills.id, { onDelete: "cascade" }),
		factId: integer("fact_id")
			.notNull()
			.references(() => facts.id, { onDelete: "cascade" }),
		createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	},
	(table) => [primaryKey({ columns: [table.skillId, table.factId] })],
);

// Execution logs - records of commands, tests, builds, experiments
export const executionLogs = sqliteTable(
	"execution_logs",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		// The command or action that was executed
		command: text("command").notNull(),
		// Working directory where it was run
		workingDirectory: text("working_directory"),
		// What we were trying to achieve (free text context)
		context: text("context"),
		// The output (stdout/stderr combined)
		output: text("output"),
		// Exit code (null for non-command actions)
		exitCode: integer("exit_code"),
		// Simple success/failure flag for easy filtering
		success: integer("success", { mode: "boolean" }).notNull(),
		// Duration in milliseconds (if tracked)
		durationMs: integer("duration_ms"),
		// Optional: the skill this execution relates to
		skillName: text("skill_name"),
		createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	},
	(table) => [
		index("execution_logs_command_idx").on(table.command),
		index("execution_logs_success_idx").on(table.success),
		index("execution_logs_skill_name_idx").on(table.skillName),
		index("execution_logs_created_at_idx").on(table.createdAt),
	],
);

export const executionLogTags = sqliteTable(
	"execution_log_tags",
	{
		executionLogId: integer("execution_log_id")
			.notNull()
			.references(() => executionLogs.id, { onDelete: "cascade" }),
		tagId: integer("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.executionLogId, table.tagId] })],
);

/**
 * Worker state table for durable tracking of background task execution.
 * Persists across process restarts (e.g., editor restarts).
 */
export const workerState = sqliteTable("worker_state", {
	taskName: text("task_name").primaryKey(),
	lastRunAt: text("last_run_at"),
	lastStatus: text("last_status"), // 'success', 'error', 'skipped'
	lastMessage: text("last_message"),
	itemsProcessed: integer("items_processed").default(0).notNull(),
	updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});
