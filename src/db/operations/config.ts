import { eq, sql } from "drizzle-orm";
import type { DB } from "../index.js";
import { config } from "../schema.js";
import { CONFIG_SCHEMA, type ConfigKey } from "../../runtime-config.js";

export async function getConfig(db: DB, key: string): Promise<string | null> {
	const result = await db
		.select()
		.from(config)
		.where(eq(config.key, key))
		.limit(1);
	return result[0]?.value ?? null;
}

export async function setConfig(
	db: DB,
	key: string,
	value: string,
): Promise<void> {
	await db
		.insert(config)
		.values({ key, value })
		.onConflictDoUpdate({
			target: config.key,
			set: { value, updatedAt: sql`(CURRENT_TIMESTAMP)` },
		});
}

export async function deleteConfig(db: DB, key: string): Promise<void> {
	await db.delete(config).where(eq(config.key, key));
}

export async function getAllConfig(db: DB): Promise<Record<string, string>> {
	const results = await db.select().from(config);
	return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

/**
 * Get config schema with descriptions and defaults for agent discovery
 */
export function getConfigSchema(): typeof CONFIG_SCHEMA {
	return CONFIG_SCHEMA;
}

/**
 * Initialize config with defaults for any missing keys.
 * This ensures all config options are discoverable and have values.
 */
export async function initializeConfigDefaults(db: DB): Promise<{
	initialized: string[];
	existing: string[];
}> {
	const existing = await getAllConfig(db);
	const initialized: string[] = [];
	const existingKeys: string[] = [];

	for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
		if (existing[key] !== undefined) {
			existingKeys.push(key);
			continue;
		}

		// Only initialize if there's a non-null default
		if (schema.default !== null) {
			await setConfig(db, key, String(schema.default));
			initialized.push(key);
		}
	}

	return { initialized, existing: existingKeys };
}

/**
 * Validate a config value against its schema
 */
export function validateConfigValue(
	key: string,
	value: string,
): { valid: boolean; error?: string } {
	const schema = CONFIG_SCHEMA[key as ConfigKey];

	if (!schema) {
		// Unknown keys are allowed for extensibility
		return { valid: true };
	}

	if (schema.type === "number") {
		const num = Number(value);
		if (Number.isNaN(num)) {
			return { valid: false, error: `${key} must be a number` };
		}
		if (num < 0) {
			return { valid: false, error: `${key} must be non-negative` };
		}
	}

	if (schema.type === "boolean") {
		if (value !== "true" && value !== "false") {
			return { valid: false, error: `${key} must be 'true' or 'false'` };
		}
	}

	if (schema.type === "json") {
		try {
			JSON.parse(value);
		} catch {
			return { valid: false, error: `${key} must be valid JSON` };
		}
	}

	if (schema.type === "string" && "values" in schema && schema.values) {
		if (!schema.values.includes(value as never)) {
			return {
				valid: false,
				error: `${key} must be one of: ${schema.values.join(", ")}`,
			};
		}
	}

	return { valid: true };
}

/**
 * Parse and validate a JSON config value
 */
export function parseJsonConfig<T>(value: string | null, defaultValue: T): T {
	if (!value) return defaultValue;
	try {
		return JSON.parse(value) as T;
	} catch {
		return defaultValue;
	}
}

/**
 * Parse a boolean config value
 */
export function parseBooleanConfig(
	value: string | null,
	defaultValue: boolean,
): boolean {
	if (value === null || value === undefined) return defaultValue;
	return value === "true";
}

/**
 * Parse a number config value
 */
export function parseNumberConfig(
	value: string | null,
	defaultValue: number,
): number {
	if (value === null || value === undefined) return defaultValue;
	const num = Number(value);
	return Number.isNaN(num) ? defaultValue : num;
}

import {
	DEFAULT_SEARCH_LIMITS,
	DEFAULT_CONTEXT_BUDGETS,
	DEFAULT_SOURCE_TYPE_TRUST,
} from "../../runtime/defaults.js";

/**
 * Get search limit for a specific entity type
 */
export async function getSearchLimit(
	db: DB,
	entityType: "tags" | "facts" | "resources" | "skills" | "executionLogs",
): Promise<number> {
	const keyMap = {
		tags: "search_limit_tags",
		facts: "search_limit_facts",
		resources: "search_limit_resources",
		skills: "search_limit_skills",
		executionLogs: "search_limit_execution_logs",
	} as const;

	const value = await getConfig(db, keyMap[entityType]);
	return parseNumberConfig(value, DEFAULT_SEARCH_LIMITS[entityType]);
}

/**
 * Get whether to include soft-deleted items in search
 */
export async function getSearchIncludeDeleted(db: DB): Promise<boolean> {
	const value = await getConfig(db, "search_include_deleted");
	return parseBooleanConfig(value, false);
}

/**
 * Get context budget for a specific entity type
 */
export async function getContextBudget(
	db: DB,
	entityType: "facts" | "resources" | "skills",
): Promise<number> {
	const keyMap = {
		facts: "context_budget_facts",
		resources: "context_budget_resources",
		skills: "context_budget_skills",
	} as const;

	const value = await getConfig(db, keyMap[entityType]);
	return parseNumberConfig(value, DEFAULT_CONTEXT_BUDGETS[entityType]);
}

/**
 * Get tag affinity weights for search ordering
 */
export async function getTagAffinityWeights(
	db: DB,
): Promise<Record<string, number>> {
	const value = await getConfig(db, "tag_affinity_weights");
	return parseJsonConfig<Record<string, number>>(value, {});
}

/**
 * Get source type trust levels
 */
export async function getSourceTypeTrust(
	db: DB,
): Promise<Record<string, number>> {
	const value = await getConfig(db, "source_type_trust");
	return parseJsonConfig<Record<string, number>>(
		value,
		DEFAULT_SOURCE_TYPE_TRUST,
	);
}

/**
 * Get staleness warning threshold (0.0 to 1.0)
 */
export async function getStalenessWarningThreshold(db: DB): Promise<number> {
	const value = await getConfig(db, "staleness_warning_threshold");
	return parseNumberConfig(value, 0.8);
}

/**
 * Get snapshot max size in KB
 */
export async function getSnapshotMaxSizeKb(db: DB): Promise<number> {
	const value = await getConfig(db, "snapshot_max_size_kb");
	return parseNumberConfig(value, 100);
}

/**
 * Get snapshot overflow behavior
 */
export async function getSnapshotOverflowBehavior(
	db: DB,
): Promise<"truncate" | "summarize" | "remove_noise" | "auto"> {
	const value = await getConfig(db, "snapshot_overflow_behavior");
	if (
		value === "truncate" ||
		value === "summarize" ||
		value === "remove_noise" ||
		value === "auto"
	) {
		return value;
	}
	return "summarize";
}
