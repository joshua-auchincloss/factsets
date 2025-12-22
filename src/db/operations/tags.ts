import { eq, like, sql, inArray, desc, asc, notInArray } from "drizzle-orm";
import type { DB } from "../index.js";
import {
	tags,
	factTags,
	resourceTags,
	skillTags,
	executionLogTags,
} from "../schema.js";
import { getSearchLimit } from "./config.js";
import type {
	TagListInput,
	TagCreateInput,
	TagListOutput,
	TagCreateOutput,
	TagPruneOrphansInput,
	TagPruneOrphansOutput,
	TagUpdateInput,
	TagUpdateOutput,
} from "../../schemas/tags.js";

export async function listTags(
	db: DB,
	input: TagListInput,
): Promise<TagListOutput> {
	// Use config-based default limit if not provided
	const configLimit = await getSearchLimit(db, "tags");
	const limit = input.limit ?? configLimit;
	const orderBy = input.orderBy ?? "usage";

	let query = db
		.select({
			id: tags.id,
			name: tags.name,
			description: tags.description,
			usageCount: tags.usageCount,
		})
		.from(tags);

	if (input.filter) {
		query = query.where(like(tags.name, `%${input.filter}%`)) as typeof query;
	}

	// biome-ignore lint/suspicious/noImplicitAnyLet: this is fine
	let orderedQuery;
	switch (orderBy) {
		case "name":
			orderedQuery = query.orderBy(asc(tags.name));
			break;
		case "recent":
			orderedQuery = query.orderBy(desc(tags.createdAt));
			break;
		case "usage":
		default:
			orderedQuery = query.orderBy(desc(tags.usageCount));
			break;
	}

	const results = await orderedQuery.limit(limit);

	return { tags: results };
}

export async function createTags(
	db: DB,
	input: TagCreateInput,
): Promise<TagCreateOutput> {
	if (input.tags.length === 0) {
		return { created: 0, tags: [] };
	}

	await db
		.insert(tags)
		.values(
			input.tags.map((tag) => ({
				name: tag.name,
				description: tag.description,
			})),
		)
		.onConflictDoNothing();

	const names = input.tags.map((t) => t.name);
	const results = await db
		.select({ id: tags.id, name: tags.name })
		.from(tags)
		.where(inArray(tags.name, names));

	return {
		created: results.length,
		tags: results,
	};
}

export async function updateTags(
	db: DB,
	input: TagUpdateInput,
): Promise<TagUpdateOutput> {
	if (input.updates.length === 0) {
		return { updated: 0, tags: [] };
	}

	const updatedTags: { id: number; name: string; description: string }[] = [];

	for (const update of input.updates) {
		await db
			.update(tags)
			.set({
				description: update.description,
				updatedAt: sql`CURRENT_TIMESTAMP`,
			})
			.where(eq(tags.name, update.name));

		const result = await db
			.select({ id: tags.id, name: tags.name, description: tags.description })
			.from(tags)
			.where(eq(tags.name, update.name))
			.limit(1);

		if (result[0]) {
			updatedTags.push(result[0]);
		}
	}

	return {
		updated: updatedTags.length,
		tags: updatedTags,
	};
}

export async function getTagByName(
	db: DB,
	name: string,
): Promise<{ id: number; name: string } | null> {
	const result = await db
		.select({ id: tags.id, name: tags.name })
		.from(tags)
		.where(eq(tags.name, name))
		.limit(1);

	return result[0] ?? null;
}

export async function getOrCreateTags(
	db: DB,
	names: string[],
): Promise<Map<string, number>> {
	if (names.length === 0) {
		return new Map();
	}

	const uniqueNames = [...new Set(names)];

	await db
		.insert(tags)
		.values(
			uniqueNames.map((name) => ({
				name,
				description: `Auto-created tag for ${name}`,
			})),
		)
		.onConflictDoNothing();

	const results = await db
		.select({ id: tags.id, name: tags.name })
		.from(tags)
		.where(inArray(tags.name, uniqueNames));

	return new Map(results.map((r) => [r.name, r.id]));
}

export async function incrementTagUsage(
	db: DB,
	tagIds: number[],
): Promise<void> {
	if (tagIds.length === 0) return;

	await db
		.update(tags)
		.set({ usageCount: sql`${tags.usageCount} + 1` })
		.where(inArray(tags.id, tagIds));
}

/**
 * Get tag IDs for search operations. Returns null if tags are provided but none match.
 * This signals to the caller that no results should be returned.
 */
export async function getTagIdsForSearch(
	db: DB,
	tagNames?: string[],
): Promise<{ tagIds: number[]; shouldReturnEmpty: boolean }> {
	if (!tagNames || tagNames.length === 0) {
		return { tagIds: [], shouldReturnEmpty: false };
	}

	const results = await db
		.select({ id: tags.id })
		.from(tags)
		.where(inArray(tags.name, tagNames));

	if (results.length === 0) {
		return { tagIds: [], shouldReturnEmpty: true };
	}

	return { tagIds: results.map((r) => r.id), shouldReturnEmpty: false };
}

/**
 * Get suggested tags based on popularity. Used when search returns no results
 * to help agents discover what exists.
 */
export async function getSuggestedTags(db: DB, limit = 5): Promise<string[]> {
	const results = await db
		.select({ name: tags.name })
		.from(tags)
		.orderBy(desc(tags.usageCount))
		.limit(limit);

	return results.map((r) => r.name);
}

/**
 * Find and optionally delete orphan tags (tags with zero usage across all junction tables).
 * This helps keep the knowledge base clean by removing unused tags.
 */
export async function pruneOrphanTags(
	db: DB,
	input: TagPruneOrphansInput,
): Promise<TagPruneOrphansOutput> {
	// Find all tag IDs that are currently in use
	const [usedInFacts, usedInResources, usedInSkills, usedInLogs] =
		await Promise.all([
			db.selectDistinct({ tagId: factTags.tagId }).from(factTags),
			db.selectDistinct({ tagId: resourceTags.tagId }).from(resourceTags),
			db.selectDistinct({ tagId: skillTags.tagId }).from(skillTags),
			db
				.selectDistinct({ tagId: executionLogTags.tagId })
				.from(executionLogTags),
		]);

	const usedTagIds = new Set([
		...usedInFacts.map((r) => r.tagId),
		...usedInResources.map((r) => r.tagId),
		...usedInSkills.map((r) => r.tagId),
		...usedInLogs.map((r) => r.tagId),
	]);

	// Find orphan tags (not in any junction table)
	let orphanTags: { id: number; name: string }[];
	if (usedTagIds.size === 0) {
		// All tags are orphans
		orphanTags = await db.select({ id: tags.id, name: tags.name }).from(tags);
	} else {
		orphanTags = await db
			.select({ id: tags.id, name: tags.name })
			.from(tags)
			.where(notInArray(tags.id, [...usedTagIds]));
	}

	if (orphanTags.length === 0) {
		return { pruned: 0 };
	}

	// Dry run mode: return count and list without deleting
	if (input.dryRun) {
		return {
			pruned: orphanTags.length,
			orphanTags,
		};
	}

	// Delete orphan tags
	const orphanIds = orphanTags.map((t) => t.id);
	await db.delete(tags).where(inArray(tags.id, orphanIds));

	return { pruned: orphanTags.length };
}
