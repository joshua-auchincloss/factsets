import type { ClientType } from "../clients.js";

/**
 * Freshness thresholds by resource category (in hours).
 * These determine when content is considered stale.
 */
export interface FreshnessConfig {
	/** Lock files like package-lock.json, bun.lockb (default: 168 = 1 week) */
	lockFiles: number;
	/** Config files like tsconfig.json, .eslintrc (default: 24 = 1 day) */
	configFiles: number;
	/** Documentation URLs and markdown files (default: 72 = 3 days) */
	documentation: number;
	/** Generated files like build outputs (default: 1 = 1 hour) */
	generatedFiles: number;
	/** API schemas: OpenAPI, GraphQL, Proto (default: 24 = 1 day) */
	apiSchemas: number;
	/** Source code files (default: 24 = 1 day) */
	sourceCode: number;
	/** Database files: SQL, migrations, seeds (default: 72 = 3 days) */
	database: number;
	/** Scripts: shell, makefiles, build helpers (default: 72 = 3 days) */
	scripts: number;
	/** Test files and fixtures (default: 24 = 1 day) */
	tests: number;
	/** Asset files: images, fonts, media (default: 168 = 1 week) */
	assets: number;
	/** Infrastructure: Terraform, K8s, Docker, CI/CD (default: 24 = 1 day) */
	infrastructure: number;
	/** Default threshold for unspecified resources (default: 168 = 1 week) */
	default: number;
}

export type FreshnessCategory = keyof FreshnessConfig;

/**
 * Runtime configuration that can be set via CLI options.
 * These take precedence over database-stored config values.
 */
export interface RuntimeConfig {
	/** Client type - determines default skills directory */
	client?: ClientType;
	/** Override skills directory path */
	skillsDir?: string;
	/** Freshness thresholds by category */
	freshness?: Partial<FreshnessConfig>;
}

/**
 * Category matching rules for URI-based categorization.
 *
 * Semantics:
 * - ANY from endsWith[] OR ANY from includes[] must match (positive match)
 * - If not.endsWith[] or not.includes[] has ANY match, the rule fails (negative exclusion)
 * - not.tagged[] is applied in a second pass after all URI-based matches are collected
 */
export type CategoryMatchRule = {
	endsWith?: string[];
	includes?: string[];
	not?: {
		endsWith?: string[];
		includes?: string[];
		tagged?: FreshnessCategory[];
	};
};
