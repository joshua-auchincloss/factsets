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

/**
 * Communication tone options
 */
export type PreferenceTone = "formal" | "neutral" | "casual" | "technical";

/**
 * Response verbosity levels
 */
export type PreferenceVerbosity =
	| "minimal"
	| "concise"
	| "balanced"
	| "detailed"
	| "comprehensive";

/**
 * Emoji/unicode usage policy - 'banned' means absolutely no emojis
 */
export type PreferenceEmojiUsage =
	| "banned"
	| "minimal"
	| "moderate"
	| "liberal";

/**
 * Decorative unicode characters policy (bullets, arrows, boxes, etc.)
 */
export type PreferenceSpecialChars = "banned" | "minimal" | "allowed";

/**
 * Interaction personality style
 */
export type PreferencePersonality =
	| "direct"
	| "friendly"
	| "professional"
	| "instructive";

/**
 * Response structure organization
 */
export type PreferenceStructureStyle = "flat" | "hierarchical" | "progressive";

/**
 * Summary/TL;DR placement
 */
export type PreferenceSummaryPosition = "omit" | "first" | "last" | "both";

/**
 * List usage preference
 */
export type PreferenceListUsage = "avoid" | "when_appropriate" | "prefer";

/**
 * Context around code blocks
 */
export type PreferenceCodeBlockContext =
	| "omit"
	| "minimal"
	| "moderate"
	| "full";

/**
 * Inline code comment density
 */
export type PreferenceCodeComments =
	| "banned"
	| "minimal"
	| "moderate"
	| "verbose";

/**
 * Inline comments inside function bodies (not docstrings)
 */
export type PreferenceCodeInlineComments =
	| "banned"
	| "critical"
	| "logical_branches"
	| "verbose";

/**
 * Decorative/banner comments in code (e.g., // ====== Section ======)
 */
export type PreferenceCodeBanners = "banned" | "minimal" | "allowed";

/**
 * Section dividers in responses (horizontal rules, decorative separators)
 */
export type PreferenceSectionDividers = "banned" | "minimal" | "allowed";

/**
 * Docstring generation policy (language-agnostic)
 */
export type PreferenceCodeDocstrings = "omit" | "public_only" | "all";

/**
 * Type annotation verbosity
 */
export type PreferenceCodeTypeAnnotations =
	| "minimal"
	| "inferred"
	| "explicit"
	| "strict";

/**
 * Error handling style in generated code
 */
export type PreferenceCodeErrorHandling =
	| "minimal"
	| "defensive"
	| "comprehensive";

/**
 * Import organization style
 */
export type PreferenceCodeImportsStyle = "minimal" | "explicit" | "grouped";

/**
 * Documentation format preference
 */
export type PreferenceDocsFormat = "plain" | "markdown" | "rich";

/**
 * Example inclusion level
 */
export type PreferenceDocsExamples =
	| "omit"
	| "minimal"
	| "moderate"
	| "comprehensive";

/**
 * Diagram preference in documentation
 */
export type PreferenceDocsDiagrams = "omit" | "ascii" | "mermaid";

/**
 * Technical explanation depth
 */
export type PreferenceDocsTechnicalDepth =
	| "simplified"
	| "balanced"
	| "detailed"
	| "expert";

/**
 * Confirmation request frequency
 */
export type PreferenceConfirmations = "skip" | "minimal" | "always";

/**
 * Proactive suggestion behavior
 */
export type PreferenceSuggestions = "omit" | "when_relevant" | "proactive";

/**
 * Question-asking behavior
 */
export type PreferenceQuestions = "avoid" | "clarifying_only" | "exploratory";

/**
 * Error reporting detail level
 */
export type PreferenceErrorDetail =
	| "minimal"
	| "actionable"
	| "diagnostic"
	| "full";

/**
 * Technical terminology level
 */
export type PreferenceTechnicalTerms = "simplified" | "standard" | "precise";

/**
 * Date format preference
 */
export type PreferenceDateFormat = "ISO" | "US" | "EU" | "relative";

/**
 * Number format preference
 */
export type PreferenceNumberFormat = "standard" | "grouped";

/**
 * Complete user preferences configuration.
 * Controls agent output behavior across all contexts.
 */
export interface UserPreferencesConfig {
	// === Communication & Response Style ===
	/** Overall communication tone */
	tone: PreferenceTone;
	/** Response length/detail level */
	verbosity: PreferenceVerbosity;
	/** Emoji usage policy - 'banned' strictly prohibits all emojis */
	emojiUsage: PreferenceEmojiUsage;
	/** Decorative unicode (bullets, arrows, etc.) policy */
	specialChars: PreferenceSpecialChars;
	/** Interaction personality style */
	personality: PreferencePersonality;

	// === Response Structure ===
	/** Information organization style */
	structureStyle: PreferenceStructureStyle;
	/** TL;DR / summary placement */
	summaryPosition: PreferenceSummaryPosition;
	/** Use markdown headers in responses */
	useHeaders: boolean;
	/** Bullet/numbered list preference */
	useLists: PreferenceListUsage;
	/** Section dividers in responses (horizontal rules, decorative separators) */
	sectionDividers: PreferenceSectionDividers;
	/** Explanation context around code blocks */
	codeBlockContext: PreferenceCodeBlockContext;

	// === Code Output ===
	/** Inline comment density in generated code */
	codeComments: PreferenceCodeComments;
	/** Inline comments inside function bodies - when to add explanatory comments */
	codeInlineComments: PreferenceCodeInlineComments;
	/** Decorative/banner comments (e.g., // ====== Section ======) */
	codeBanners: PreferenceCodeBanners;
	/** Docstring generation policy */
	codeDocstrings: PreferenceCodeDocstrings;
	/** Type annotation verbosity */
	codeTypeAnnotations: PreferenceCodeTypeAnnotations;
	/** Error handling comprehensiveness */
	codeErrorHandling: PreferenceCodeErrorHandling;
	/** Freeform notes on naming conventions */
	codeNamingNotes: string | null;
	/** Target line length for code */
	codeLineLength: number;
	/** Import statement organization */
	codeImportsStyle: PreferenceCodeImportsStyle;

	// === Documentation Output ===
	/** Documentation format preference */
	docsFormat: PreferenceDocsFormat;
	/** Example code/usage inclusion level */
	docsExamples: PreferenceDocsExamples;
	/** Diagram inclusion preference */
	docsDiagrams: PreferenceDocsDiagrams;
	/** Technical explanation depth */
	docsTechnicalDepth: PreferenceDocsTechnicalDepth;

	// === Interaction Behavior ===
	/** Confirmation request frequency */
	confirmations: PreferenceConfirmations;
	/** Proactive improvement suggestions */
	suggestions: PreferenceSuggestions;
	/** Question-asking behavior */
	questions: PreferenceQuestions;
	/** Error reporting detail level */
	errorDetail: PreferenceErrorDetail;
	/** Show progress on long operations */
	progressUpdates: boolean;

	// === Language & Format ===
	/** Primary language (ISO 639-1 code) */
	language: string;
	/** Technical terminology level */
	technicalTerms: PreferenceTechnicalTerms;
	/** Date formatting style */
	dateFormat: PreferenceDateFormat;
	/** Number formatting style */
	numberFormat: PreferenceNumberFormat;
}
