/**
 * Centralized constants for auto-generated placeholder values.
 *
 * These markers indicate content that needs agent attention:
 * - Auto-migrated: Created during schema migrations for existing data
 * - Auto-generated: Created by the system when a value wasn't provided
 *
 * Agents should actively look for and update these placeholders when encountered.
 */

/**
 * Prefix used to identify auto-generated content that needs review
 */
export const AUTO_GENERATED_PREFIX = "[auto-generated]";

/**
 * Prefix used to identify content migrated from older schema versions
 */
export const AUTO_MIGRATED_PREFIX = "[auto-migrated]";

/**
 * Default placeholder for descriptions that need to be filled in
 */
export const PLACEHOLDER_DESCRIPTION = `${AUTO_MIGRATED_PREFIX} Needs description`;

/**
 * Check if a string contains an auto-generated or auto-migrated placeholder
 */
export function isPlaceholderValue(value: string | null | undefined): boolean {
	if (!value) return false;
	return (
		value.startsWith(AUTO_GENERATED_PREFIX) ||
		value.startsWith(AUTO_MIGRATED_PREFIX)
	);
}

/**
 * Check if a description needs to be updated by an agent
 */
export function needsDescriptionUpdate(
	description: string | null | undefined,
): boolean {
	return isPlaceholderValue(description);
}

/**
 * All placeholder prefixes for pattern matching
 */
export const PLACEHOLDER_PREFIXES = [
	AUTO_GENERATED_PREFIX,
	AUTO_MIGRATED_PREFIX,
] as const;
