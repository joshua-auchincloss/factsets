import type { DB } from "../index.js";
import { getConfig, parseJsonConfig } from "./config.js";

/**
 * Tag synonyms: alias -> canonical
 * Example: { "db": "database", "docs": "documentation" }
 */
export type TagSynonyms = Record<string, string>;

/**
 * Tag hierarchies: child -> parent
 * Example: { "mcp-tools": "mcp", "drizzle": "database" }
 */
export type TagHierarchies = Record<string, string>;

/**
 * Required tags: entityType -> required tag patterns
 * Example: { "facts": [], "skills": ["workflow"] }
 */
export type RequiredTags = Record<string, string[]>;

/**
 * Get tag synonyms from config
 */
export async function getTagSynonyms(db: DB): Promise<TagSynonyms> {
	const value = await getConfig(db, "tag_synonyms");
	return parseJsonConfig<TagSynonyms>(value, {});
}

/**
 * Get tag hierarchies from config
 */
export async function getTagHierarchies(db: DB): Promise<TagHierarchies> {
	const value = await getConfig(db, "tag_hierarchies");
	return parseJsonConfig<TagHierarchies>(value, {});
}

/**
 * Get required tags from config
 */
export async function getRequiredTags(db: DB): Promise<RequiredTags> {
	const value = await getConfig(db, "required_tags");
	return parseJsonConfig<RequiredTags>(value, {});
}

/**
 * Expand a list of tags to include synonyms.
 * Bidirectional: searching "db" also finds "database" and vice versa.
 */
export function expandTagsWithSynonyms(
	tags: string[],
	synonyms: TagSynonyms,
): string[] {
	const expanded = new Set<string>(tags);

	// Build reverse mapping: canonical -> aliases
	const reverseMap = new Map<string, Set<string>>();
	for (const [alias, canonical] of Object.entries(synonyms)) {
		if (!reverseMap.has(canonical)) {
			reverseMap.set(canonical, new Set());
		}
		reverseMap.get(canonical)!.add(alias);
	}

	for (const tag of tags) {
		// If tag is an alias, add canonical
		if (synonyms[tag]) {
			expanded.add(synonyms[tag]);
		}

		// If tag is canonical, add all aliases
		const aliases = reverseMap.get(tag);
		if (aliases) {
			for (const alias of aliases) {
				expanded.add(alias);
			}
		}
	}

	return Array.from(expanded);
}

/**
 * Expand a list of tags to include children (when searching by parent).
 * Parent search includes all descendants.
 */
export function expandTagsWithHierarchy(
	tags: string[],
	hierarchies: TagHierarchies,
): string[] {
	const expanded = new Set<string>(tags);

	// Build parent -> children map
	const childrenMap = new Map<string, Set<string>>();
	for (const [child, parent] of Object.entries(hierarchies)) {
		if (!childrenMap.has(parent)) {
			childrenMap.set(parent, new Set());
		}
		childrenMap.get(parent)!.add(child);
	}

	// For each tag, add all descendants
	const addDescendants = (tag: string) => {
		const children = childrenMap.get(tag);
		if (children) {
			for (const child of children) {
				if (!expanded.has(child)) {
					expanded.add(child);
					addDescendants(child); // Recursive for multi-level hierarchies
				}
			}
		}
	};

	for (const tag of tags) {
		addDescendants(tag);
	}

	return Array.from(expanded);
}

/**
 * Fully expand tags with both synonyms and hierarchy.
 * Order: synonyms first, then hierarchy (so synonym parents are also expanded).
 */
export async function expandTags(db: DB, tags: string[]): Promise<string[]> {
	if (tags.length === 0) return [];

	const [synonyms, hierarchies] = await Promise.all([
		getTagSynonyms(db),
		getTagHierarchies(db),
	]);

	// First expand synonyms
	let expanded = expandTagsWithSynonyms(tags, synonyms);

	// Then expand hierarchy
	expanded = expandTagsWithHierarchy(expanded, hierarchies);

	// Apply synonyms again in case hierarchy introduced new canonical forms
	expanded = expandTagsWithSynonyms(expanded, synonyms);

	return expanded;
}

/**
 * Validate that all required tags are present for an entity type (sync version).
 * Supports pattern matching with trailing * for prefix match.
 * Use this when you already have the required tags config.
 */
export function validateRequiredTagsSync(
	entityType: string,
	providedTags: string[],
	requiredTags: RequiredTags,
): { valid: boolean; missing: string[] } {
	const patterns = requiredTags[entityType] ?? [];
	if (patterns.length === 0) {
		return { valid: true, missing: [] };
	}

	const missing: string[] = [];
	const tagSet = new Set(providedTags);

	for (const pattern of patterns) {
		if (pattern.endsWith("*")) {
			// Prefix match
			const prefix = pattern.slice(0, -1);
			const hasMatch = providedTags.some((tag) => tag.startsWith(prefix));
			if (!hasMatch) {
				missing.push(pattern);
			}
		} else {
			// Exact match
			if (!tagSet.has(pattern)) {
				missing.push(pattern);
			}
		}
	}

	return { valid: missing.length === 0, missing };
}

/**
 * Validate that all required tags are present for an entity type.
 * Supports pattern matching with trailing * for prefix match.
 * Fetches required tags config from database.
 */
export async function validateRequiredTags(
	db: DB,
	entityType: string,
	providedTags: string[],
): Promise<{ valid: boolean; missing: string[] }> {
	const requiredTags = await getRequiredTags(db);
	return validateRequiredTagsSync(entityType, providedTags, requiredTags);
}
