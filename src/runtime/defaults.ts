import type { FreshnessConfig } from "./types.js";
import { DEFAULT_CLIENT } from "../clients.js";

/**
 * Default freshness values in hours
 */
export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
	sourceCode: 12, // 12 hours - active development

	lockFiles: 24 * 7, // 1 week - rarely change
	configFiles: 24, // 1 day - may change with tooling updates
	documentation: 24 * 3, // 3 days - updates periodically
	generatedFiles: 1, // 1 hour - regenerate frequently
	apiSchemas: 24, // 1 day - API contracts change carefully
	database: 24 * 3, // 3 days - migrations are versioned
	scripts: 24 * 3, // 3 days - build scripts evolve slowly
	tests: 24, // 1 day - tests change with source
	assets: 24 * 7, // 1 week - binary files rarely change
	infrastructure: 24, // 1 day - infra changes need attention
	default: 24 * 7, // 1 week - conservative default
};

/**
 * Default search limits per entity type
 */
export const DEFAULT_SEARCH_LIMITS = {
	tags: 100,
	facts: 50,
	resources: 100,
	skills: 30,
	executionLogs: 50,
};

/**
 * Default context budgets for get_knowledge_context
 */
export const DEFAULT_CONTEXT_BUDGETS = {
	facts: 50,
	resources: 20,
	skills: 10,
};

/**
 * Default source type trust levels (0.0 to 1.0)
 */
export const DEFAULT_SOURCE_TYPE_TRUST = {
	user: 1.0,
	documentation: 0.9,
	code: 0.85,
	inference: 0.7,
};

/**
 * Default snapshot management settings
 */
export const DEFAULT_SNAPSHOT_SETTINGS = {
	maxSizeKb: 100,
	overflowBehavior: "summarize" as const,
	retentionVersions: 1,
};

/**
 * Snapshot overflow behaviors
 */
export type SnapshotOverflowBehavior =
	| "truncate"
	| "summarize"
	| "remove_noise"
	| "auto";

/**
 * Default worker intervals in milliseconds
 */
export const DEFAULT_WORKER_INTERVALS = {
	autoVerify: 60 * 60 * 1000, // 1 hour
	expireFacts: 6 * 60 * 60 * 1000, // 6 hours
	pruneSnapshots: 24 * 60 * 60 * 1000, // 24 hours
	pruneTags: 24 * 60 * 60 * 1000, // 24 hours
	hardDelete: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * All configuration keys with their types and defaults.
 * Used for CLI help, validation, and database config management.
 */
export const CONFIG_SCHEMA = {
	// Client configuration
	client: {
		description: "Client type - determines default skills directory",
		type: "string" as const,
		values: ["github-copilot", "cursor", "windsurf", "claude-desktop"],
		default: DEFAULT_CLIENT,
	},
	skills_dir: {
		description: "Override skills directory path",
		type: "string" as const,
		default: null,
	},

	// Freshness thresholds (existing)
	freshness_lock_files: {
		description: "Hours before lock files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.lockFiles,
	},
	freshness_config_files: {
		description: "Hours before config files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.configFiles,
	},
	freshness_documentation: {
		description: "Hours before documentation is considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.documentation,
	},
	freshness_generated_files: {
		description: "Hours before generated files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.generatedFiles,
	},
	freshness_api_schemas: {
		description: "Hours before API schemas are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.apiSchemas,
	},
	freshness_source_code: {
		description: "Hours before source code files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.sourceCode,
	},
	freshness_database: {
		description: "Hours before database files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.database,
	},
	freshness_scripts: {
		description: "Hours before script files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.scripts,
	},
	freshness_tests: {
		description: "Hours before test files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.tests,
	},
	freshness_assets: {
		description: "Hours before asset files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.assets,
	},
	freshness_infrastructure: {
		description: "Hours before infrastructure files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.infrastructure,
	},
	freshness_default: {
		description: "Default hours before resources are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.default,
	},

	// Search default limits
	search_limit_tags: {
		description: "Default limit for list_tags results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.tags,
	},
	search_limit_facts: {
		description: "Default limit for search_facts results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.facts,
	},
	search_limit_resources: {
		description: "Default limit for search_resources results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.resources,
	},
	search_limit_skills: {
		description: "Default limit for search_skills results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.skills,
	},
	search_limit_execution_logs: {
		description: "Default limit for search_execution_logs results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.executionLogs,
	},
	search_include_deleted: {
		description: "Include soft-deleted items in search results",
		type: "boolean" as const,
		default: false,
	},

	// Context budgets
	context_budget_facts: {
		description: "Maximum facts in get_knowledge_context",
		type: "number" as const,
		default: DEFAULT_CONTEXT_BUDGETS.facts,
	},
	context_budget_resources: {
		description: "Maximum resources in get_knowledge_context",
		type: "number" as const,
		default: DEFAULT_CONTEXT_BUDGETS.resources,
	},
	context_budget_skills: {
		description: "Maximum skills in get_knowledge_context",
		type: "number" as const,
		default: DEFAULT_CONTEXT_BUDGETS.skills,
	},

	// Tag affinity weights (JSON: {tag: weight})
	tag_affinity_weights: {
		description:
			"JSON object mapping tag names to weight multipliers for search ordering",
		type: "json" as const,
		default: "{}",
	},

	// Fact lifecycle
	fact_auto_verify_after_days: {
		description:
			"Days after which uncontested facts are auto-verified (null = disabled)",
		type: "number" as const,
		default: null,
	},
	fact_expiration_days: {
		description:
			"Days after which unverified facts are soft-deleted (null = disabled)",
		type: "number" as const,
		default: null,
	},

	// Source type trust (JSON: {sourceType: trust})
	source_type_trust: {
		description:
			"JSON object mapping source types to trust levels (0.0-1.0) for ordering",
		type: "json" as const,
		default: JSON.stringify(DEFAULT_SOURCE_TYPE_TRUST),
	},

	// Tag relationships (JSON)
	tag_synonyms: {
		description:
			"JSON object mapping alias tags to canonical tags for query expansion",
		type: "json" as const,
		default: "{}",
	},
	tag_hierarchies: {
		description:
			"JSON object mapping child tags to parent tags for hierarchical search",
		type: "json" as const,
		default: "{}",
	},

	// Required tags (JSON: {entityType: [tags]})
	required_tags: {
		description:
			"JSON object mapping entity types to required tag arrays for creation",
		type: "json" as const,
		default: "{}",
	},

	// Snapshot management
	snapshot_max_size_kb: {
		description: "Maximum snapshot size in KB before overflow behavior applies",
		type: "number" as const,
		default: DEFAULT_SNAPSHOT_SETTINGS.maxSizeKb,
	},
	snapshot_overflow_behavior: {
		description:
			"How to handle snapshots exceeding max size: truncate, summarize, remove_noise, auto",
		type: "string" as const,
		values: ["truncate", "summarize", "remove_noise", "auto"],
		default: DEFAULT_SNAPSHOT_SETTINGS.overflowBehavior,
	},
	snapshot_retention_versions: {
		description: "Number of snapshot versions to retain per resource",
		type: "number" as const,
		default: DEFAULT_SNAPSHOT_SETTINGS.retentionVersions,
	},

	// Maintenance
	auto_prune_orphan_tags: {
		description: "Automatically prune tags not linked to any entities",
		type: "boolean" as const,
		default: false,
	},
	soft_delete_retention_days: {
		description: "Days to retain soft-deleted items before hard deletion",
		type: "number" as const,
		default: 7,
	},
	staleness_warning_threshold: {
		description:
			"Fraction of freshness limit at which to warn (0.0-1.0, e.g., 0.8 = 80%)",
		type: "number" as const,
		default: 0.8,
	},

	// Worker intervals (milliseconds)
	worker_interval_auto_verify: {
		description: "Milliseconds between auto-verify runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.autoVerify,
	},
	worker_interval_expire_facts: {
		description: "Milliseconds between fact expiration runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.expireFacts,
	},
	worker_interval_prune_snapshots: {
		description: "Milliseconds between snapshot pruning runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.pruneSnapshots,
	},
	worker_interval_prune_tags: {
		description: "Milliseconds between orphan tag pruning runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.pruneTags,
	},
	worker_interval_hard_delete: {
		description: "Milliseconds between hard deletion runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.hardDelete,
	},
} as const;

export type ConfigKey = keyof typeof CONFIG_SCHEMA;
