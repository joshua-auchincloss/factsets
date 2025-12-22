import type { FreshnessConfig, UserPreferencesConfig } from "./types.js";
import { DEFAULT_CLIENT } from "../clients.js";

/**
 * Config categories for organization and filtering
 */
export type ConfigCategory =
	| "client"
	| "freshness"
	| "search"
	| "context"
	| "tags"
	| "facts"
	| "snapshots"
	| "maintenance"
	| "workers"
	| "preferences";

/**
 * Config value types
 */
export type ConfigType = "string" | "number" | "boolean" | "json";

/**
 * Base config entry - all entries must have these fields
 */
interface ConfigEntryBase {
	description: string;
	type: ConfigType;
	category: ConfigCategory;
	default: string | number | boolean | null;
}

/**
 * String config entry with optional enum values
 */
interface ConfigEntryString extends ConfigEntryBase {
	type: "string";
	values?: readonly string[];
	default: string | null;
}

/**
 * Number config entry
 */
interface ConfigEntryNumber extends ConfigEntryBase {
	type: "number";
	default: number | null;
}

/**
 * Boolean config entry
 */
interface ConfigEntryBoolean extends ConfigEntryBase {
	type: "boolean";
	default: boolean;
}

/**
 * JSON config entry for complex objects
 */
interface ConfigEntryJson extends ConfigEntryBase {
	type: "json";
	default: string;
}

/**
 * Union of all config entry types
 */
export type ConfigEntry =
	| ConfigEntryString
	| ConfigEntryNumber
	| ConfigEntryBoolean
	| ConfigEntryJson;

/**
 * The full config schema type
 */
export type ConfigSchemaType = Record<string, ConfigEntry>;

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
 * Default user preferences - optimized for token efficiency and clarity.
 * These represent a direct, no-frills interaction style.
 */
export const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
	// Communication - token efficient, no decoration
	tone: "neutral",
	verbosity: "concise",
	emojiUsage: "banned",
	specialChars: "banned",
	personality: "direct",

	// Response structure - minimal overhead
	structureStyle: "flat",
	summaryPosition: "omit",
	useHeaders: true,
	useLists: "when_appropriate",
	sectionDividers: "banned",
	codeBlockContext: "minimal",

	// Code - clean, typed, minimal comments
	codeComments: "minimal",
	codeInlineComments: "critical",
	codeBanners: "banned",
	codeDocstrings: "public_only",
	codeTypeAnnotations: "explicit",
	codeErrorHandling: "defensive",
	codeNamingNotes: null,
	codeLineLength: 100,
	codeImportsStyle: "grouped",

	// Documentation
	docsFormat: "markdown",
	docsExamples: "minimal",
	docsDiagrams: "omit",
	docsTechnicalDepth: "balanced",

	// Interaction - minimal interruption
	confirmations: "minimal",
	suggestions: "when_relevant",
	questions: "clarifying_only",
	errorDetail: "actionable",
	progressUpdates: false,

	// Language
	language: "en",
	technicalTerms: "precise",
	dateFormat: "ISO",
	numberFormat: "standard",
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
 *
 * Every entry must include a category for organization.
 */
export const CONFIG_SCHEMA = {
	client: {
		description: "Client type - determines default skills directory",
		type: "string" as const,
		values: ["github-copilot", "cursor", "windsurf", "claude-desktop"],
		default: DEFAULT_CLIENT,
		category: "client" as const,
	},
	skills_dir: {
		description: "Override skills directory path",
		type: "string" as const,
		default: null,
		category: "client" as const,
	},

	freshness_lock_files: {
		description: "Hours before lock files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.lockFiles,
		category: "freshness" as const,
	},
	freshness_config_files: {
		description: "Hours before config files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.configFiles,
		category: "freshness" as const,
	},
	freshness_documentation: {
		description: "Hours before documentation is considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.documentation,
		category: "freshness" as const,
	},
	freshness_generated_files: {
		description: "Hours before generated files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.generatedFiles,
		category: "freshness" as const,
	},
	freshness_api_schemas: {
		description: "Hours before API schemas are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.apiSchemas,
		category: "freshness" as const,
	},
	freshness_source_code: {
		description: "Hours before source code files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.sourceCode,
		category: "freshness" as const,
	},
	freshness_database: {
		description: "Hours before database files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.database,
		category: "freshness" as const,
	},
	freshness_scripts: {
		description: "Hours before script files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.scripts,
		category: "freshness" as const,
	},
	freshness_tests: {
		description: "Hours before test files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.tests,
		category: "freshness" as const,
	},
	freshness_assets: {
		description: "Hours before asset files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.assets,
		category: "freshness" as const,
	},
	freshness_infrastructure: {
		description: "Hours before infrastructure files are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.infrastructure,
		category: "freshness" as const,
	},
	freshness_default: {
		description: "Default hours before resources are considered stale",
		type: "number" as const,
		default: DEFAULT_FRESHNESS_CONFIG.default,
		category: "freshness" as const,
	},

	search_limit_tags: {
		description: "Default limit for list_tags results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.tags,
		category: "search" as const,
	},
	search_limit_facts: {
		description: "Default limit for search_facts results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.facts,
		category: "search" as const,
	},
	search_limit_resources: {
		description: "Default limit for search_resources results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.resources,
		category: "search" as const,
	},
	search_limit_skills: {
		description: "Default limit for search_skills results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.skills,
		category: "search" as const,
	},
	search_limit_execution_logs: {
		description: "Default limit for search_execution_logs results",
		type: "number" as const,
		default: DEFAULT_SEARCH_LIMITS.executionLogs,
		category: "search" as const,
	},
	search_include_deleted: {
		description: "Include soft-deleted items in search results",
		type: "boolean" as const,
		default: false,
		category: "search" as const,
	},

	context_budget_facts: {
		description: "Maximum facts in get_knowledge_context",
		type: "number" as const,
		default: DEFAULT_CONTEXT_BUDGETS.facts,
		category: "context" as const,
	},
	context_budget_resources: {
		description: "Maximum resources in get_knowledge_context",
		type: "number" as const,
		default: DEFAULT_CONTEXT_BUDGETS.resources,
		category: "context" as const,
	},
	context_budget_skills: {
		description: "Maximum skills in get_knowledge_context",
		type: "number" as const,
		default: DEFAULT_CONTEXT_BUDGETS.skills,
		category: "context" as const,
	},

	tag_affinity_weights: {
		description:
			"JSON object mapping tag names to weight multipliers for search ordering",
		type: "json" as const,
		default: "{}",
		category: "tags" as const,
	},
	tag_synonyms: {
		description:
			"JSON object mapping alias tags to canonical tags for query expansion",
		type: "json" as const,
		default: "{}",
		category: "tags" as const,
	},
	tag_hierarchies: {
		description:
			"JSON object mapping child tags to parent tags for hierarchical search",
		type: "json" as const,
		default: "{}",
		category: "tags" as const,
	},
	required_tags: {
		description:
			"JSON object mapping entity types to required tag arrays for creation",
		type: "json" as const,
		default: "{}",
		category: "tags" as const,
	},

	fact_auto_verify_after_days: {
		description:
			"Days after which uncontested facts are auto-verified (null = disabled)",
		type: "number" as const,
		default: null,
		category: "facts" as const,
	},
	fact_expiration_days: {
		description:
			"Days after which unverified facts are soft-deleted (null = disabled)",
		type: "number" as const,
		default: null,
		category: "facts" as const,
	},
	source_type_trust: {
		description:
			"JSON object mapping source types to trust levels (0.0-1.0) for ordering",
		type: "json" as const,
		default: JSON.stringify(DEFAULT_SOURCE_TYPE_TRUST),
		category: "facts" as const,
	},

	snapshot_max_size_kb: {
		description: "Maximum snapshot size in KB before overflow behavior applies",
		type: "number" as const,
		default: DEFAULT_SNAPSHOT_SETTINGS.maxSizeKb,
		category: "snapshots" as const,
	},
	snapshot_overflow_behavior: {
		description:
			"How to handle snapshots exceeding max size: truncate, summarize, remove_noise, auto",
		type: "string" as const,
		values: ["truncate", "summarize", "remove_noise", "auto"],
		default: DEFAULT_SNAPSHOT_SETTINGS.overflowBehavior,
		category: "snapshots" as const,
	},
	snapshot_retention_versions: {
		description: "Number of snapshot versions to retain per resource",
		type: "number" as const,
		default: DEFAULT_SNAPSHOT_SETTINGS.retentionVersions,
		category: "snapshots" as const,
	},

	auto_prune_orphan_tags: {
		description: "Automatically prune tags not linked to any entities",
		type: "boolean" as const,
		default: false,
		category: "maintenance" as const,
	},
	soft_delete_retention_days: {
		description: "Days to retain soft-deleted items before hard deletion",
		type: "number" as const,
		default: 7,
		category: "maintenance" as const,
	},
	staleness_warning_threshold: {
		description:
			"Fraction of freshness limit at which to warn (0.0-1.0, e.g., 0.8 = 80%)",
		type: "number" as const,
		default: 0.8,
		category: "maintenance" as const,
	},

	worker_interval_auto_verify: {
		description: "Milliseconds between auto-verify runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.autoVerify,
		category: "workers" as const,
	},
	worker_interval_expire_facts: {
		description: "Milliseconds between fact expiration runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.expireFacts,
		category: "workers" as const,
	},
	worker_interval_prune_snapshots: {
		description: "Milliseconds between snapshot pruning runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.pruneSnapshots,
		category: "workers" as const,
	},
	worker_interval_prune_tags: {
		description: "Milliseconds between orphan tag pruning runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.pruneTags,
		category: "workers" as const,
	},
	worker_interval_hard_delete: {
		description: "Milliseconds between hard deletion runs",
		type: "number" as const,
		default: DEFAULT_WORKER_INTERVALS.hardDelete,
		category: "workers" as const,
	},

	pref_tone: {
		description: "Communication tone: formal, neutral, casual, technical",
		type: "string" as const,
		values: ["formal", "neutral", "casual", "technical"],
		default: DEFAULT_USER_PREFERENCES.tone,
		category: "preferences" as const,
	},
	pref_verbosity: {
		description:
			"Response verbosity: minimal, concise, balanced, detailed, comprehensive",
		type: "string" as const,
		values: ["minimal", "concise", "balanced", "detailed", "comprehensive"],
		default: DEFAULT_USER_PREFERENCES.verbosity,
		category: "preferences" as const,
	},
	pref_emoji_usage: {
		description:
			"Emoji policy: banned (strictly prohibited), minimal, moderate, liberal",
		type: "string" as const,
		values: ["banned", "minimal", "moderate", "liberal"],
		default: DEFAULT_USER_PREFERENCES.emojiUsage,
		category: "preferences" as const,
	},
	pref_special_chars: {
		description:
			"Decorative unicode (bullets, arrows, boxes): banned, minimal, allowed",
		type: "string" as const,
		values: ["banned", "minimal", "allowed"],
		default: DEFAULT_USER_PREFERENCES.specialChars,
		category: "preferences" as const,
	},
	pref_personality: {
		description:
			"Interaction personality: direct, friendly, professional, instructive",
		type: "string" as const,
		values: ["direct", "friendly", "professional", "instructive"],
		default: DEFAULT_USER_PREFERENCES.personality,
		category: "preferences" as const,
	},

	pref_structure_style: {
		description: "Response organization: flat, hierarchical, progressive",
		type: "string" as const,
		values: ["flat", "hierarchical", "progressive"],
		default: DEFAULT_USER_PREFERENCES.structureStyle,
		category: "preferences" as const,
	},
	pref_summary_position: {
		description: "TL;DR placement: omit, first, last, both",
		type: "string" as const,
		values: ["omit", "first", "last", "both"],
		default: DEFAULT_USER_PREFERENCES.summaryPosition,
		category: "preferences" as const,
	},
	pref_use_headers: {
		description: "Use markdown headers in responses",
		type: "boolean" as const,
		default: DEFAULT_USER_PREFERENCES.useHeaders,
		category: "preferences" as const,
	},
	pref_use_lists: {
		description: "List usage: avoid, when_appropriate, prefer",
		type: "string" as const,
		values: ["avoid", "when_appropriate", "prefer"],
		default: DEFAULT_USER_PREFERENCES.useLists,
		category: "preferences" as const,
	},
	pref_section_dividers: {
		description:
			"Section dividers (horizontal rules, decorative separators): banned, minimal, allowed",
		type: "string" as const,
		values: ["banned", "minimal", "allowed"],
		default: DEFAULT_USER_PREFERENCES.sectionDividers,
		category: "preferences" as const,
	},
	pref_code_block_context: {
		description:
			"Explanation around code blocks: omit, minimal, moderate, full",
		type: "string" as const,
		values: ["omit", "minimal", "moderate", "full"],
		default: DEFAULT_USER_PREFERENCES.codeBlockContext,
		category: "preferences" as const,
	},

	pref_code_comments: {
		description:
			"Inline comment density: banned (no comments), critical only, minimal, moderate, verbose",
		type: "string" as const,
		values: ["banned", "critical", "minimal", "moderate", "verbose"],
		default: DEFAULT_USER_PREFERENCES.codeComments,
		category: "preferences" as const,
	},
	pref_code_inline_comments: {
		description:
			"Inline comments inside function bodies: banned, critical (only critical code), logical_branches (at conditionals/loops), verbose",
		type: "string" as const,
		values: ["banned", "critical", "logical_branches", "verbose"],
		default: DEFAULT_USER_PREFERENCES.codeInlineComments,
		category: "preferences" as const,
	},
	pref_code_banners: {
		description:
			"Decorative/banner comments (e.g., // ====== Section ======): banned, minimal, allowed",
		type: "string" as const,
		values: ["banned", "minimal", "allowed"],
		default: DEFAULT_USER_PREFERENCES.codeBanners,
		category: "preferences" as const,
	},
	pref_code_docstrings: {
		description: "Docstring generation: omit, public_only, all",
		type: "string" as const,
		values: ["omit", "public_only", "all"],
		default: DEFAULT_USER_PREFERENCES.codeDocstrings,
		category: "preferences" as const,
	},
	pref_code_type_annotations: {
		description:
			"Type annotation verbosity: minimal, inferred, explicit, strict",
		type: "string" as const,
		values: ["minimal", "inferred", "explicit", "strict"],
		default: DEFAULT_USER_PREFERENCES.codeTypeAnnotations,
		category: "preferences" as const,
	},
	pref_code_error_handling: {
		description: "Error handling style: minimal, defensive, comprehensive",
		type: "string" as const,
		values: ["minimal", "defensive", "comprehensive"],
		default: DEFAULT_USER_PREFERENCES.codeErrorHandling,
		category: "preferences" as const,
	},
	pref_code_naming_notes: {
		description: "Freeform notes on preferred naming conventions",
		type: "string" as const,
		default: DEFAULT_USER_PREFERENCES.codeNamingNotes,
		category: "preferences" as const,
	},
	pref_code_line_length: {
		description: "Target line length for code (60-200)",
		type: "number" as const,
		default: DEFAULT_USER_PREFERENCES.codeLineLength,
		category: "preferences" as const,
	},
	pref_code_imports_style: {
		description: "Import organization: minimal, explicit, grouped",
		type: "string" as const,
		values: ["minimal", "explicit", "grouped"],
		default: DEFAULT_USER_PREFERENCES.codeImportsStyle,
		category: "preferences" as const,
	},

	pref_docs_format: {
		description: "Documentation format: plain, markdown, rich",
		type: "string" as const,
		values: ["plain", "markdown", "rich"],
		default: DEFAULT_USER_PREFERENCES.docsFormat,
		category: "preferences" as const,
	},
	pref_docs_examples: {
		description: "Example inclusion: omit, minimal, moderate, comprehensive",
		type: "string" as const,
		values: ["omit", "minimal", "moderate", "comprehensive"],
		default: DEFAULT_USER_PREFERENCES.docsExamples,
		category: "preferences" as const,
	},
	pref_docs_diagrams: {
		description: "Diagram preference: omit, ascii, mermaid",
		type: "string" as const,
		values: ["omit", "ascii", "mermaid"],
		default: DEFAULT_USER_PREFERENCES.docsDiagrams,
		category: "preferences" as const,
	},
	pref_docs_technical_depth: {
		description: "Technical depth: simplified, balanced, detailed, expert",
		type: "string" as const,
		values: ["simplified", "balanced", "detailed", "expert"],
		default: DEFAULT_USER_PREFERENCES.docsTechnicalDepth,
		category: "preferences" as const,
	},

	pref_confirmations: {
		description: "Confirmation requests: skip, minimal, always",
		type: "string" as const,
		values: ["skip", "minimal", "always"],
		default: DEFAULT_USER_PREFERENCES.confirmations,
		category: "preferences" as const,
	},
	pref_suggestions: {
		description: "Proactive suggestions: omit, when_relevant, proactive",
		type: "string" as const,
		values: ["omit", "when_relevant", "proactive"],
		default: DEFAULT_USER_PREFERENCES.suggestions,
		category: "preferences" as const,
	},
	pref_questions: {
		description: "Question behavior: avoid, clarifying_only, exploratory",
		type: "string" as const,
		values: ["avoid", "clarifying_only", "exploratory"],
		default: DEFAULT_USER_PREFERENCES.questions,
		category: "preferences" as const,
	},
	pref_error_detail: {
		description: "Error reporting: minimal, actionable, diagnostic, full",
		type: "string" as const,
		values: ["minimal", "actionable", "diagnostic", "full"],
		default: DEFAULT_USER_PREFERENCES.errorDetail,
		category: "preferences" as const,
	},
	pref_progress_updates: {
		description: "Show progress on long operations",
		type: "boolean" as const,
		default: DEFAULT_USER_PREFERENCES.progressUpdates,
		category: "preferences" as const,
	},

	pref_language: {
		description: "Primary language (ISO 639-1 code, e.g., en, es, fr)",
		type: "string" as const,
		default: DEFAULT_USER_PREFERENCES.language,
		category: "preferences" as const,
	},
	pref_technical_terms: {
		description: "Technical terminology: simplified, standard, precise",
		type: "string" as const,
		values: ["simplified", "standard", "precise"],
		default: DEFAULT_USER_PREFERENCES.technicalTerms,
		category: "preferences" as const,
	},
	pref_date_format: {
		description: "Date format: ISO, US, EU, relative",
		type: "string" as const,
		values: ["ISO", "US", "EU", "relative"],
		default: DEFAULT_USER_PREFERENCES.dateFormat,
		category: "preferences" as const,
	},
	pref_number_format: {
		description: "Number format: standard, grouped",
		type: "string" as const,
		values: ["standard", "grouped"],
		default: DEFAULT_USER_PREFERENCES.numberFormat,
		category: "preferences" as const,
	},
} as const satisfies ConfigSchemaType;

export type ConfigKey = keyof typeof CONFIG_SCHEMA;
