import {
	sqliteTable,
	text,
	integer,
	primaryKey,
	index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const config = sqliteTable("config", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const tags = sqliteTable("tags", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description"),
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
	},
	(table) => [
		index("facts_content_idx").on(table.content),
		index("facts_source_type_idx").on(table.sourceType),
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
	},
	(table) => [
		index("resources_uri_idx").on(table.uri),
		index("resources_type_idx").on(table.type),
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
		description: text("description"),
		filePath: text("file_path").notNull(),
		contentHash: text("content_hash"),
		retrievalCount: integer("retrieval_count").default(0).notNull(),
		lastRetrievedAt: text("last_retrieved_at"),
		needsReview: integer("needs_review", { mode: "boolean" })
			.default(false)
			.notNull(),
		systemId: text("system_id").unique(),
		systemHash: text("system_hash"),
		createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
		updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	},
	(table) => [index("skills_name_idx").on(table.name)],
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
