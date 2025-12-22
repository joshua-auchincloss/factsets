import type { ClientType } from "../clients.js";
import { getSkillsDir, isValidClient, DEFAULT_CLIENT } from "../clients.js";
import type {
	RuntimeConfig,
	FreshnessConfig,
	FreshnessCategory,
} from "./types.js";
import { DEFAULT_FRESHNESS_CONFIG } from "./defaults.js";

/**
 * In-memory runtime configuration state.
 * This takes precedence over database-stored config values.
 */
let runtimeConfig: RuntimeConfig = {};

/**
 * Set runtime configuration (typically from CLI options).
 */
export function setRuntimeConfig(config: RuntimeConfig): void {
	runtimeConfig = { ...config };
}

/**
 * Get current runtime configuration.
 */
export function getRuntimeConfig(): RuntimeConfig {
	return runtimeConfig;
}

/**
 * Get effective client type, with precedence:
 * 1. Runtime config (CLI option)
 * 2. Database config (if provided)
 * 3. Default client
 */
export function getEffectiveClient(dbClient?: string | null): ClientType {
	if (runtimeConfig.client) {
		return runtimeConfig.client;
	}
	if (dbClient && isValidClient(dbClient)) {
		return dbClient;
	}
	return DEFAULT_CLIENT;
}

/**
 * Get effective skills directory, with precedence:
 * 1. Runtime config skillsDir (CLI option)
 * 2. Database config skills_dir
 * 3. Derived from effective client
 */
export function getEffectiveSkillsDir(
	dbSkillsDir?: string | null,
	dbClient?: string | null,
): string {
	if (runtimeConfig.skillsDir) {
		return runtimeConfig.skillsDir;
	}
	if (dbSkillsDir) {
		return dbSkillsDir;
	}
	return getSkillsDir(getEffectiveClient(dbClient));
}

/**
 * Get effective freshness config, with precedence:
 * 1. Runtime config freshness (CLI/programmatic)
 * 2. Database config values
 * 3. Defaults
 */
export function getEffectiveFreshness(
	dbConfig?: Record<string, string>,
): FreshnessConfig {
	const base = { ...DEFAULT_FRESHNESS_CONFIG };

	// Apply database config
	if (dbConfig) {
		if (dbConfig.freshness_lock_files) {
			base.lockFiles = Number(dbConfig.freshness_lock_files);
		}
		if (dbConfig.freshness_config_files) {
			base.configFiles = Number(dbConfig.freshness_config_files);
		}
		if (dbConfig.freshness_documentation) {
			base.documentation = Number(dbConfig.freshness_documentation);
		}
		if (dbConfig.freshness_generated_files) {
			base.generatedFiles = Number(dbConfig.freshness_generated_files);
		}
		if (dbConfig.freshness_api_schemas) {
			base.apiSchemas = Number(dbConfig.freshness_api_schemas);
		}
		if (dbConfig.freshness_source_code) {
			base.sourceCode = Number(dbConfig.freshness_source_code);
		}
		if (dbConfig.freshness_database) {
			base.database = Number(dbConfig.freshness_database);
		}
		if (dbConfig.freshness_scripts) {
			base.scripts = Number(dbConfig.freshness_scripts);
		}
		if (dbConfig.freshness_tests) {
			base.tests = Number(dbConfig.freshness_tests);
		}
		if (dbConfig.freshness_assets) {
			base.assets = Number(dbConfig.freshness_assets);
		}
		if (dbConfig.freshness_infrastructure) {
			base.infrastructure = Number(dbConfig.freshness_infrastructure);
		}
		if (dbConfig.freshness_default) {
			base.default = Number(dbConfig.freshness_default);
		}
	}

	// Apply runtime config overrides
	if (runtimeConfig.freshness) {
		Object.assign(base, runtimeConfig.freshness);
	}

	return base;
}

/**
 * Get freshness threshold for a specific resource category.
 */
export function getFreshnessForCategory(
	category: FreshnessCategory,
	dbConfig?: Record<string, string>,
): number {
	const freshness = getEffectiveFreshness(dbConfig);
	return freshness[category] ?? freshness.default;
}

/**
 * Get the minimum freshness threshold across multiple categories.
 * Use this when a resource matches multiple categories - the strictest
 * (smallest) threshold wins to ensure we don't miss stale content.
 */
export function getFreshnessForCategories(
	categories: FreshnessCategory[],
	dbConfig?: Record<string, string>,
): number {
	if (categories.length === 0) {
		return getFreshnessForCategory("default", dbConfig);
	}

	const freshness = getEffectiveFreshness(dbConfig);
	let minThreshold = Infinity;

	for (const category of categories) {
		const threshold = freshness[category] ?? freshness.default;
		if (threshold < minThreshold) {
			minThreshold = threshold;
		}
	}

	return minThreshold === Infinity ? freshness.default : minThreshold;
}
