import type { DB } from "../db/index.js";
import { getAllConfig, setConfig, getConfig } from "../db/operations/config.js";
import {
	CONFIG_SCHEMA,
	DEFAULT_USER_PREFERENCES,
} from "../runtime/defaults.js";
import type { UserPreferencesConfig } from "../runtime/types.js";
import { z } from "zod";
import type { McpServerCompat } from "../types.js";

function getPreferenceKeys(): string[] {
	return Object.entries(CONFIG_SCHEMA)
		.filter(
			([_, schema]) =>
				"category" in schema && schema.category === "preferences",
		)
		.map(([key]) => key);
}

function configKeyToField(key: string): string {
	return key
		.replace(/^pref_/, "")
		.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function getCurrentPreferences(db: DB): Promise<UserPreferencesConfig> {
	const allConfig = await getAllConfig(db);
	const prefKeys = getPreferenceKeys();

	const prefs = { ...DEFAULT_USER_PREFERENCES };

	for (const key of prefKeys) {
		const value = allConfig[key];
		if (value !== undefined && value !== null) {
			const field = configKeyToField(key) as keyof UserPreferencesConfig;
			const schema = CONFIG_SCHEMA[key as keyof typeof CONFIG_SCHEMA];

			// Type coercion based on schema type
			if (schema.type === "boolean") {
				(prefs as Record<string, unknown>)[field] = value === "true";
			} else if (schema.type === "number") {
				(prefs as Record<string, unknown>)[field] = Number(value);
			} else {
				(prefs as Record<string, unknown>)[field] = value;
			}
		}
	}

	return prefs;
}

function describePreference(key: string, value: unknown): string {
	const schema = CONFIG_SCHEMA[key as keyof typeof CONFIG_SCHEMA];
	if (!schema) return "";

	const field = configKeyToField(key);

	// Special handling for banned values - make them explicit
	if (value === "banned") {
		if (key === "pref_emoji_usage") {
			return "User BANS all emojis - never use any emoji characters";
		}
		if (key === "pref_special_chars") {
			return "User BANS decorative unicode - no bullets, arrows, or special characters";
		}
		if (key === "pref_code_comments") {
			return "User BANS inline code comments - do not add comments to code";
		}
		if (key === "pref_code_inline_comments") {
			return "User BANS inline comments inside functions - no explanatory comments in code bodies";
		}
		if (key === "pref_code_banners") {
			return "User BANS decorative/banner comments - no // ===== Section ===== style blocks";
		}
		if (key === "pref_section_dividers") {
			return "User BANS section dividers - no horizontal rules or decorative separators";
		}
	}

	// Special handling for omit values
	if (value === "omit") {
		if (key === "pref_summary_position") {
			return "User prefers no TL;DR or summary sections";
		}
		if (key === "pref_docs_diagrams") {
			return "User prefers no diagrams in documentation";
		}
		if (key === "pref_docs_examples") {
			return "User prefers no examples in documentation";
		}
		if (key === "pref_code_docstrings") {
			return "User prefers no docstrings";
		}
		if (key === "pref_code_block_context") {
			return "User prefers no explanation around code blocks";
		}
		if (key === "pref_suggestions") {
			return "User prefers no proactive suggestions";
		}
	}

	// Special handling for avoid/skip values
	if (value === "avoid") {
		if (key === "pref_use_lists") {
			return "User prefers to avoid bullet/numbered lists";
		}
		if (key === "pref_questions") {
			return "User prefers to avoid questions - proceed with best judgment";
		}
	}
	if (value === "skip") {
		if (key === "pref_confirmations") {
			return "User prefers skipping confirmations - proceed without asking";
		}
	}

	// Boolean handling
	if (typeof value === "boolean") {
		if (key === "pref_use_headers") {
			return value
				? "User prefers markdown headers for organization"
				: "User prefers no markdown headers";
		}
		if (key === "pref_progress_updates") {
			return value
				? "User wants progress updates on long operations"
				: "User prefers no progress updates";
		}
	}

	// Generate descriptive text for other values
	const descriptions: Record<string, Record<string, string>> = {
		pref_tone: {
			formal: "User prefers formal, professional tone",
			neutral: "User prefers neutral, balanced tone",
			casual: "User prefers casual, conversational tone",
			technical: "User prefers technical, precise tone",
		},
		pref_verbosity: {
			minimal: "User prefers extremely brief responses - minimum tokens",
			concise: "User prefers concise responses - no unnecessary words",
			balanced: "User prefers balanced detail level",
			detailed: "User prefers detailed explanations",
			comprehensive: "User prefers comprehensive, thorough responses",
		},
		pref_personality: {
			direct: "User prefers direct, no-frills communication",
			friendly: "User prefers friendly, approachable communication",
			professional: "User prefers professional, business-like communication",
			instructive: "User prefers instructive, teaching-oriented communication",
		},
		pref_structure_style: {
			flat: "User prefers flat, sequential response structure",
			hierarchical: "User prefers hierarchical, nested structure",
			progressive: "User prefers progressive disclosure of information",
		},
		pref_code_comments: {
			minimal: "User prefers minimal inline comments in code",
			moderate: "User prefers moderate commenting in code",
			verbose: "User prefers verbose commenting in code",
		},
		pref_code_inline_comments: {
			critical:
				"User prefers inline comments only for critical/non-obvious code",
			logical_branches:
				"User prefers inline comments at conditionals, loops, and decision points",
			verbose: "User prefers inline comments throughout code for clarity",
		},
		pref_code_banners: {
			minimal: "User prefers minimal decorative/banner comments",
			allowed: "User allows decorative/banner comments in code",
		},
		pref_section_dividers: {
			minimal: "User prefers minimal section dividers in responses",
			allowed: "User allows section dividers and horizontal rules",
		},
		pref_code_docstrings: {
			public_only: "User prefers docstrings only on public APIs",
			all: "User prefers docstrings on all functions/methods",
		},
		pref_code_type_annotations: {
			minimal: "User prefers minimal type annotations",
			inferred: "User prefers letting types be inferred where possible",
			explicit: "User prefers explicit type annotations",
			strict: "User prefers strict, comprehensive type annotations",
		},
		pref_code_error_handling: {
			minimal: "User prefers minimal error handling",
			defensive: "User prefers defensive error handling",
			comprehensive: "User prefers comprehensive error handling",
		},
		pref_code_imports_style: {
			minimal: "User prefers minimal imports",
			explicit: "User prefers explicit, individual imports",
			grouped: "User prefers grouped, organized imports",
		},
		pref_docs_format: {
			plain: "User prefers plain text documentation",
			markdown: "User prefers markdown documentation",
			rich: "User prefers rich formatting in documentation",
		},
		pref_docs_examples: {
			minimal: "User prefers minimal examples in documentation",
			moderate: "User prefers moderate examples in documentation",
			comprehensive: "User prefers comprehensive examples in documentation",
		},
		pref_docs_diagrams: {
			ascii: "User prefers ASCII diagrams",
			mermaid: "User prefers Mermaid diagrams",
		},
		pref_docs_technical_depth: {
			simplified: "User prefers simplified technical explanations",
			balanced: "User prefers balanced technical depth",
			detailed: "User prefers detailed technical explanations",
			expert: "User prefers expert-level technical depth",
		},
		pref_confirmations: {
			minimal:
				"User prefers minimal confirmations - only for destructive actions",
			always: "User prefers always confirming before actions",
		},
		pref_suggestions: {
			when_relevant: "User accepts suggestions when clearly relevant",
			proactive: "User welcomes proactive improvement suggestions",
		},
		pref_questions: {
			clarifying_only: "User accepts clarifying questions only when necessary",
			exploratory: "User welcomes exploratory questions",
		},
		pref_error_detail: {
			minimal: "User prefers minimal error details",
			actionable: "User prefers actionable error information",
			diagnostic: "User prefers diagnostic error details",
			full: "User prefers full error details with stack traces",
		},
		pref_technical_terms: {
			simplified: "User prefers simplified terminology",
			standard: "User prefers standard technical terminology",
			precise: "User prefers precise, domain-specific terminology",
		},
		pref_date_format: {
			ISO: "User prefers ISO date format (YYYY-MM-DD)",
			US: "User prefers US date format (MM/DD/YYYY)",
			EU: "User prefers EU date format (DD/MM/YYYY)",
			relative: "User prefers relative dates (e.g., '2 days ago')",
		},
		pref_number_format: {
			standard: "User prefers standard number format",
			grouped: "User prefers grouped numbers (e.g., 1,000,000)",
		},
		pref_use_lists: {
			when_appropriate: "User accepts lists when appropriate",
			prefer: "User prefers using lists for organization",
		},
		pref_code_block_context: {
			minimal: "User prefers minimal context around code blocks",
			moderate: "User prefers moderate explanation with code",
			full: "User prefers full context and explanation with code",
		},
	};

	const keyDescriptions = descriptions[key];
	if (keyDescriptions && typeof value === "string" && keyDescriptions[value]) {
		return keyDescriptions[value];
	}

	// Special cases for string/number values
	if (key === "pref_language") {
		return `User prefers responses in language: ${value}`;
	}
	if (key === "pref_code_line_length") {
		return `User prefers code line length of ${value} characters`;
	}
	if (key === "pref_code_naming_notes" && value) {
		return `User naming convention notes: ${value}`;
	}

	return "";
}

function generatePreferencePrompt(prefs: UserPreferencesConfig): string {
	const lines: string[] = [];
	const prefKeys = getPreferenceKeys();

	// Group preferences by category for organized output
	const categories = {
		communication: [
			"pref_tone",
			"pref_verbosity",
			"pref_emoji_usage",
			"pref_special_chars",
			"pref_personality",
		],
		structure: [
			"pref_structure_style",
			"pref_summary_position",
			"pref_use_headers",
			"pref_use_lists",
			"pref_section_dividers",
			"pref_code_block_context",
		],
		code: [
			"pref_code_comments",
			"pref_code_inline_comments",
			"pref_code_banners",
			"pref_code_docstrings",
			"pref_code_type_annotations",
			"pref_code_error_handling",
			"pref_code_naming_notes",
			"pref_code_line_length",
			"pref_code_imports_style",
		],
		documentation: [
			"pref_docs_format",
			"pref_docs_examples",
			"pref_docs_diagrams",
			"pref_docs_technical_depth",
		],
		interaction: [
			"pref_confirmations",
			"pref_suggestions",
			"pref_questions",
			"pref_error_detail",
			"pref_progress_updates",
		],
		language: [
			"pref_language",
			"pref_technical_terms",
			"pref_date_format",
			"pref_number_format",
		],
	};

	for (const [category, keys] of Object.entries(categories)) {
		const categoryLines: string[] = [];

		for (const key of keys) {
			const field = configKeyToField(key) as keyof UserPreferencesConfig;
			const value = prefs[field];

			// Skip null/undefined values
			if (value === null || value === undefined) continue;

			const description = describePreference(key, value);
			if (description) {
				categoryLines.push(`- ${description}`);
			}
		}

		if (categoryLines.length > 0) {
			lines.push(...categoryLines);
		}
	}

	return lines.join("\n");
}

// Input schemas
const inferPreferenceInput = z.object({
	key: z
		.string()
		.min(1)
		.describe("Config key to update (e.g., pref_emoji_usage)"),
	value: z.string().min(1).describe("New value for the preference"),
	reason: z.string().min(1).describe("Why this preference was inferred"),
	confidence: z.number().min(0).max(1).describe("Confidence level 0.0-1.0"),
	explicit: z
		.boolean()
		.describe("True if user explicitly stated this preference"),
});

const resetPreferencesInput = z.object({
	keys: z
		.array(z.string())
		.optional()
		.describe("Specific preference keys to reset, or omit for all"),
});

export function registerPreferencesTools(server: McpServerCompat, db: DB) {
	/**
	 * Get all user preferences as structured data
	 */
	server.registerTool(
		"get_user_preferences",
		{
			title: "Get User Preferences",
			description:
				"Get all user preferences including communication style, code output, documentation, and interaction settings",
			inputSchema: z.object({}),
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const prefs = await getCurrentPreferences(db);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(prefs, null, 2),
					},
				],
			};
		},
	);

	/**
	 * Get preference prompt - generates natural language description of all preferences
	 */
	server.registerTool(
		"get_preference_prompt",
		{
			title: "Get Preference Prompt",
			description:
				"Generate a natural language prompt describing all user preferences. Use this to understand how to format responses, code, and documentation according to user preferences.",
			inputSchema: z.object({}),
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const prefs = await getCurrentPreferences(db);
			const prompt = generatePreferencePrompt(prefs);

			return {
				content: [
					{
						type: "text",
						text: `# User Preferences\n\nFollow these preferences when generating responses:\n\n${prompt}`,
					},
				],
			};
		},
	);

	/**
	 * Infer and update a user preference based on user feedback or behavior
	 */
	server.registerTool(
		"infer_preference",
		{
			title: "Infer User Preference",
			description:
				"Update a user preference based on explicit statement or inferred behavior. Use when user indicates a preference (e.g., 'no emojis', 'be more concise'). Explicit preferences are always applied; inferred ones require high confidence.",
			inputSchema: inferPreferenceInput,
			annotations: {
				idempotentHint: true,
			},
		},
		async ({ key, value, reason, confidence, explicit }) => {
			// Validate the key is a preference key
			const prefKeys = getPreferenceKeys();
			if (!prefKeys.includes(key)) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: `Invalid preference key: ${key}. Must be one of: ${prefKeys.join(", ")}`,
							}),
						},
					],
				};
			}

			// Validate the value against schema
			const schema = CONFIG_SCHEMA[key as keyof typeof CONFIG_SCHEMA];
			if ("values" in schema && schema.values) {
				const validValues = schema.values as readonly string[];
				if (!validValues.includes(value)) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									success: false,
									error: `Invalid value '${value}' for ${key}. Must be one of: ${validValues.join(", ")}`,
								}),
							},
						],
					};
				}
			}

			// Check if user has explicitly set this preference
			const currentValue = await getConfig(db, key);
			const hasExplicitValue = currentValue !== null;

			// Only auto-update if:
			// 1. User explicitly stated the preference, OR
			// 2. High confidence AND no existing explicit value
			if (!explicit && confidence < 0.8) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								skipped: true,
								reason: `Confidence ${confidence} below threshold 0.8 for inferred preference`,
							}),
						},
					],
				};
			}

			if (!explicit && hasExplicitValue) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								skipped: true,
								reason: "User has already explicitly set this preference",
								currentValue,
							}),
						},
					],
				};
			}

			// Update the preference
			await setConfig(db, key, value);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							key,
							value,
							reason,
							confidence,
							explicit,
							previousValue: currentValue,
						}),
					},
				],
			};
		},
	);

	/**
	 * Reset preferences to defaults
	 */
	server.registerTool(
		"reset_preferences",
		{
			title: "Reset User Preferences",
			description:
				"Reset user preferences to defaults. Optionally specify keys to reset specific preferences only.",
			inputSchema: resetPreferencesInput,
			annotations: {
				idempotentHint: true,
			},
		},
		async ({ keys }) => {
			const prefKeys = getPreferenceKeys();
			const keysToReset = keys?.filter((k) => prefKeys.includes(k)) ?? prefKeys;

			const reset: string[] = [];
			for (const key of keysToReset) {
				const schema = CONFIG_SCHEMA[key as keyof typeof CONFIG_SCHEMA];
				if (schema) {
					await setConfig(db, key, String(schema.default ?? ""));
					reset.push(key);
				}
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							reset,
							count: reset.length,
						}),
					},
				],
			};
		},
	);

	/**
	 * Register user_preferences prompt - exposes same functionality as get_preference_prompt tool
	 */
	server.registerPrompt(
		"user_preferences",
		{
			description:
				"Get user preferences as a natural language prompt. Returns formatted preferences for communication style, code output, documentation, and interaction settings. Use this at session start or before generating significant output.",
		},
		async () => {
			const prefs = await getCurrentPreferences(db);
			const prompt = generatePreferencePrompt(prefs);

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: `# User Preferences\n\nFollow these preferences when generating responses:\n\n${prompt}`,
						},
					},
				],
			};
		},
	);
}
