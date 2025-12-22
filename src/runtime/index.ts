// Types
export type {
	FreshnessConfig,
	FreshnessCategory,
	RuntimeConfig,
	CategoryMatchRule,
} from "./types.js";

// Defaults and schema
export {
	DEFAULT_FRESHNESS_CONFIG,
	DEFAULT_SEARCH_LIMITS,
	DEFAULT_CONTEXT_BUDGETS,
	DEFAULT_SOURCE_TYPE_TRUST,
	DEFAULT_SNAPSHOT_SETTINGS,
	DEFAULT_WORKER_INTERVALS,
	CONFIG_SCHEMA,
	type ConfigKey,
	type ConfigCategory,
	type ConfigType,
	type ConfigEntry,
	type ConfigSchemaType,
	type SnapshotOverflowBehavior,
} from "./defaults.js";

// Runtime config state and getters
export {
	setRuntimeConfig,
	getRuntimeConfig,
	getEffectiveClient,
	getEffectiveSkillsDir,
	getEffectiveFreshness,
	getFreshnessForCategory,
	getFreshnessForCategories,
} from "./config.js";

// Category inference
export { inferResourceCategory, CATEGORY_RULES } from "./categories.js";
