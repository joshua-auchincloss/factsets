import { eq, like, sql, inArray, desc, asc } from "drizzle-orm";
import type { DB } from "../index.js";
import { tags } from "../schema.js";
import type {
	TagListInput,
	TagCreateInput,
	TagListOutput,
	TagCreateOutput,
} from "../../schemas/tags.js";

export async function listTags(
	db: DB,
	input: TagListInput,
): Promise<TagListOutput> {
	const limit = input.limit ?? 100;
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
		.values(uniqueNames.map((name) => ({ name })))
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
