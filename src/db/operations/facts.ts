import {
	eq,
	like,
	sql,
	inArray,
	and,
	lt,
	desc,
	asc,
	isNull,
} from "drizzle-orm";
import type { DB } from "../index.js";
import { facts, factTags, tags } from "../schema.js";
import {
	getOrCreateTags,
	incrementTagUsage,
	getSuggestedTags,
} from "./tags.js";
import { expandTags, validateRequiredTags } from "./tag-relationships.js";
import { getSearchLimit, getSearchIncludeDeleted } from "./config.js";
import { decodeCursor, getNextCursor } from "../../utils/cursor.js";
import type {
	FactSubmitInput,
	FactSearchInput,
	FactVerifyInput,
	FactDeleteInput,
	FactUpdateInput,
	FactVerifyByTagsInput,
	FactSubmitOutput,
	FactSearchOutput,
} from "../../schemas/facts.js";

export async function submitFacts(
	db: DB,
	input: FactSubmitInput,
): Promise<FactSubmitOutput> {
	if (input.facts.length === 0) {
		return { created: 0, updated: 0, facts: [] };
	}

	// Validate required tags for each fact
	for (const fact of input.facts) {
		const validation = await validateRequiredTags(db, "facts", fact.tags);
		if (!validation.valid) {
			throw new Error(
				`Required tags missing for fact: ${validation.missing.join(", ")}`,
			);
		}
	}

	const allTagNames = [...new Set(input.facts.flatMap((f) => f.tags))];
	const tagMap = await getOrCreateTags(db, allTagNames);

	const existingFacts = await db
		.select({ id: facts.id, content: facts.content })
		.from(facts)
		.where(
			inArray(
				facts.content,
				input.facts.map((f) => f.content),
			),
		);

	const existingContentMap = new Map(
		existingFacts.map((f) => [f.content, f.id]),
	);

	const toInsert = input.facts.filter(
		(f) => !existingContentMap.has(f.content),
	);
	const toUpdate = input.facts.filter((f) => existingContentMap.has(f.content));

	if (toUpdate.length > 0) {
		for (const fact of toUpdate) {
			await db
				.update(facts)
				.set({
					source: fact.source,
					sourceType: fact.sourceType,
					verified: fact.verified ?? false,
					updatedAt: sql`(CURRENT_TIMESTAMP)`,
				})
				.where(eq(facts.content, fact.content));
		}
	}

	let insertedFacts: { id: number; content: string }[] = [];
	if (toInsert.length > 0) {
		insertedFacts = await db
			.insert(facts)
			.values(
				toInsert.map((fact) => ({
					content: fact.content,
					source: fact.source,
					sourceType: fact.sourceType,
					verified: fact.verified ?? false,
				})),
			)
			.returning({ id: facts.id, content: facts.content });

		const factTagValues: { factId: number; tagId: number }[] = [];
		for (let i = 0; i < insertedFacts.length; i++) {
			const inserted = insertedFacts[i];
			const factInput = toInsert[i];
			if (!inserted || !factInput) continue;
			for (const tagName of factInput.tags) {
				const tagId = tagMap.get(tagName);
				if (tagId) {
					factTagValues.push({ factId: inserted.id, tagId });
				}
			}
		}

		if (factTagValues.length > 0) {
			await db.insert(factTags).values(factTagValues).onConflictDoNothing();
		}
	}

	const allResults = [
		...insertedFacts,
		...toUpdate.map((f) => ({
			// biome-ignore lint/style/noNonNullAssertion: guaranteed
			id: existingContentMap.get(f.content)!,
			content: f.content,
		})),
	];

	return {
		created: insertedFacts.length,
		updated: toUpdate.length,
		facts: allResults,
	};
}

export async function searchFacts(
	db: DB,
	input: FactSearchInput,
): Promise<FactSearchOutput> {
	// Use config-based default limit if not provided
	const configLimit = await getSearchLimit(db, "facts");
	const limit = input.limit ?? configLimit;
	const orderBy = input.orderBy ?? "recent";
	const tagIdsToIncrement: number[] = [];

	// Check if we should include soft-deleted items
	const includeDeleted = await getSearchIncludeDeleted(db);

	// Parse cursor for offset
	let offset = 0;
	if (input.cursor) {
		const cursorData = decodeCursor(input.cursor);
		if (!cursorData) {
			throw new Error("Invalid cursor");
		}
		offset = cursorData.offset;
	}

	// Build conditions array (filter soft deleted unless config says otherwise)
	const conditions: ReturnType<typeof eq>[] = includeDeleted
		? []
		: [isNull(facts.deletedAt)];

	// Build tag IDs if needed, with synonym/hierarchy expansion
	let tagIds: number[] = [];
	if (input.tags && input.tags.length > 0) {
		// Expand tags using synonyms and hierarchies from config
		const expandedTags = await expandTags(db, input.tags);

		const tagResults = await db
			.select({ id: tags.id })
			.from(tags)
			.where(inArray(tags.name, expandedTags));

		if (tagResults.length === 0) {
			// No matching tags - suggest popular ones
			const suggestedTags = await getSuggestedTags(db, 5);
			return { facts: [], suggestedTags };
		}

		tagIds = tagResults.map((t) => t.id);
		tagIdsToIncrement.push(...tagIds);
	}

	// Add query condition
	if (input.query) {
		conditions.push(like(facts.content, `%${input.query}%`));
	}

	// Add verified filter
	if (input.verifiedOnly) {
		conditions.push(eq(facts.verified, true));
	}

	// Add sourceType filter
	if (input.sourceType) {
		conditions.push(eq(facts.sourceType, input.sourceType));
	}

	// Build query for results
	let query = db
		.selectDistinct({
			id: facts.id,
			content: facts.content,
			verified: facts.verified,
			sourceType: facts.sourceType,
			updatedAt: facts.updatedAt,
			retrievalCount: facts.retrievalCount,
		})
		.from(facts);

	// Apply tag join and all conditions
	if (tagIds.length > 0) {
		query = query
			.innerJoin(factTags, eq(facts.id, factTags.factId))
			.where(
				and(inArray(factTags.tagId, tagIds), ...conditions),
			) as unknown as typeof query;
	} else {
		query = query.where(and(...conditions)) as unknown as typeof query;
	}

	// Apply ordering
	// biome-ignore lint/suspicious/noImplicitAnyLet: this is fine
	let orderedQuery;
	switch (orderBy) {
		case "oldest":
			orderedQuery = query.orderBy(asc(facts.updatedAt));
			break;
		case "usage":
			orderedQuery = query.orderBy(desc(facts.retrievalCount));
			break;
		case "recent":
		default:
			orderedQuery = query.orderBy(desc(facts.updatedAt));
			break;
	}

	// Fetch limit + 1 to determine if there are more results
	const results = await orderedQuery.offset(offset).limit(limit + 1);

	// Check if there are more results
	const hasMore = results.length > limit;
	const pageResults = hasMore ? results.slice(0, limit) : results;

	if (tagIdsToIncrement.length > 0) {
		await incrementTagUsage(db, tagIdsToIncrement);
	}

	if (pageResults.length > 0) {
		await db
			.update(facts)
			.set({
				retrievalCount: sql`${facts.retrievalCount} + 1`,
				lastRetrievedAt: sql`(CURRENT_TIMESTAMP)`,
			})
			.where(
				inArray(
					facts.id,
					pageResults.map((r) => r.id),
				),
			);
	}

	const factsWithTags = await Promise.all(
		pageResults.map(async (fact) => {
			const factTagsResult = await db
				.select({ name: tags.name })
				.from(factTags)
				.innerJoin(tags, eq(factTags.tagId, tags.id))
				.where(eq(factTags.factId, fact.id));

			return {
				id: fact.id,
				content: fact.content,
				tags: factTagsResult.map((t) => t.name),
				verified: fact.verified,
				sourceType: fact.sourceType,
				updatedAt: fact.updatedAt,
			};
		}),
	);

	// Include suggestedTags when results are empty
	if (factsWithTags.length === 0) {
		const suggestedTags = await getSuggestedTags(db, 5);
		return {
			facts: [],
			suggestedTags,
		};
	}

	return {
		facts: factsWithTags,
		nextCursor: getNextCursor(offset, limit, results.length),
	};
}

export async function verifyFacts(
	db: DB,
	input: FactVerifyInput,
): Promise<void> {
	await db
		.update(facts)
		.set({
			verified: true,
			updatedAt: sql`(CURRENT_TIMESTAMP)`,
		})
		.where(inArray(facts.id, input.ids));
}

export async function deleteFacts(
	db: DB,
	input: FactDeleteInput,
): Promise<number> {
	const conditions = [];

	// Exclude already deleted facts
	conditions.push(sql`${facts.deletedAt} IS NULL`);

	if (input.ids && input.ids.length > 0) {
		conditions.push(inArray(facts.id, input.ids));
	}

	if (input.tags && input.tags.length > 0) {
		const tagResults = await db
			.select({ id: tags.id })
			.from(tags)
			.where(inArray(tags.name, input.tags));

		if (tagResults.length > 0) {
			const factIdsWithTags = await db
				.select({ factId: factTags.factId })
				.from(factTags)
				.where(
					inArray(
						factTags.tagId,
						tagResults.map((t) => t.id),
					),
				);

			if (factIdsWithTags.length > 0) {
				conditions.push(
					inArray(
						facts.id,
						factIdsWithTags.map((f) => f.factId),
					),
				);
			}
		}
	}

	if (input.olderThan) {
		conditions.push(lt(facts.createdAt, input.olderThan));
	}

	if (input.unverifiedOnly) {
		conditions.push(eq(facts.verified, false));
	}

	if (conditions.length <= 1) {
		// Only the deletedAt IS NULL condition
		return 0;
	}

	// Soft delete: set deletedAt timestamp
	if (input.soft) {
		const result = await db
			.update(facts)
			.set({ deletedAt: sql`(CURRENT_TIMESTAMP)` as unknown as string })
			.where(and(...conditions))
			.returning({ id: facts.id });
		return result.length;
	}

	// Hard delete
	const result = await db
		.delete(facts)
		.where(and(...conditions))
		.returning({ id: facts.id });

	return result.length;
}

export async function restoreFacts(
	db: DB,
	ids: number[],
): Promise<{ restored: number }> {
	if (ids.length === 0) {
		return { restored: 0 };
	}

	const result = await db
		.update(facts)
		.set({ deletedAt: null })
		.where(and(inArray(facts.id, ids), sql`${facts.deletedAt} IS NOT NULL`))
		.returning({ id: facts.id });

	return { restored: result.length };
}

export interface FactUpdateResult {
	success: boolean;
	id: number;
	content: string;
	tagsAdded?: string[];
	tagsRemoved?: string[];
}

export async function updateFact(
	db: DB,
	input: FactUpdateInput,
): Promise<FactUpdateResult> {
	// Find the fact by ID or content
	let factId: number | undefined;
	let currentContent: string | undefined;

	if (input.id) {
		const found = await db
			.select({ id: facts.id, content: facts.content })
			.from(facts)
			.where(eq(facts.id, input.id))
			.limit(1);
		if (found[0]) {
			factId = found[0].id;
			currentContent = found[0].content;
		}
	} else if (input.contentMatch) {
		const found = await db
			.select({ id: facts.id, content: facts.content })
			.from(facts)
			.where(eq(facts.content, input.contentMatch))
			.limit(1);
		if (found[0]) {
			factId = found[0].id;
			currentContent = found[0].content;
		}
	}

	if (!factId || !currentContent) {
		throw new Error(
			input.id
				? `Fact with ID ${input.id} not found`
				: `Fact with content "${input.contentMatch}" not found`,
		);
	}

	const { updates } = input;
	const updateFields: Record<string, unknown> = {};

	if (updates.content !== undefined) {
		updateFields.content = updates.content;
	}
	if (updates.source !== undefined) {
		updateFields.source = updates.source;
	}
	if (updates.sourceType !== undefined) {
		updateFields.sourceType = updates.sourceType;
	}
	if (updates.verified !== undefined) {
		updateFields.verified = updates.verified;
	}

	// Always update the timestamp
	updateFields.updatedAt = sql`(CURRENT_TIMESTAMP)`;

	// Apply field updates
	if (Object.keys(updateFields).length > 0) {
		await db.update(facts).set(updateFields).where(eq(facts.id, factId));
	}

	// Handle tag updates
	let tagsAdded: string[] = [];
	let tagsRemoved: string[] = [];

	if (updates.tags) {
		// Replace all tags
		await db.delete(factTags).where(eq(factTags.factId, factId));
		const tagMap = await getOrCreateTags(db, updates.tags);
		const newFactTags = updates.tags
			.map((name) => {
				const tagId = tagMap.get(name);
				return tagId ? { factId, tagId } : null;
			})
			.filter((v): v is { factId: number; tagId: number } => v !== null);
		if (newFactTags.length > 0) {
			await db.insert(factTags).values(newFactTags).onConflictDoNothing();
		}
		tagsAdded = updates.tags;
	} else {
		// Handle append/remove
		if (updates.appendTags && updates.appendTags.length > 0) {
			const tagMap = await getOrCreateTags(db, updates.appendTags);
			const newFactTags = updates.appendTags
				.map((name) => {
					const tagId = tagMap.get(name);
					return tagId ? { factId, tagId } : null;
				})
				.filter((v): v is { factId: number; tagId: number } => v !== null);
			if (newFactTags.length > 0) {
				await db.insert(factTags).values(newFactTags).onConflictDoNothing();
			}
			tagsAdded = updates.appendTags;
		}

		if (updates.removeTags && updates.removeTags.length > 0) {
			const tagResults = await db
				.select({ id: tags.id, name: tags.name })
				.from(tags)
				.where(inArray(tags.name, updates.removeTags));
			if (tagResults.length > 0) {
				await db.delete(factTags).where(
					and(
						eq(factTags.factId, factId),
						inArray(
							factTags.tagId,
							tagResults.map((t) => t.id),
						),
					),
				);
				tagsRemoved = tagResults.map((t) => t.name);
			}
		}
	}

	// Get final content
	const finalFact = await db
		.select({ content: facts.content })
		.from(facts)
		.where(eq(facts.id, factId))
		.limit(1);

	return {
		id: factId,
		success: true,
		content: finalFact[0]?.content ?? currentContent,
		...(tagsAdded.length > 0 && { tagsAdded }),
		...(tagsRemoved.length > 0 && { tagsRemoved }),
	};
}

export interface VerifyByTagsResult {
	verified: number;
	factIds: number[];
}

export async function verifyFactsByTags(
	db: DB,
	input: FactVerifyByTagsInput,
): Promise<VerifyByTagsResult> {
	// Get tag IDs
	const tagResults = await db
		.select({ id: tags.id })
		.from(tags)
		.where(inArray(tags.name, input.tags));

	if (tagResults.length === 0) {
		return { verified: 0, factIds: [] };
	}

	const tagIds = tagResults.map((t) => t.id);

	let factIdsToVerify: number[];

	if (input.requireAll) {
		// Facts must have ALL specified tags
		const factTagCounts = await db
			.select({
				factId: factTags.factId,
				tagCount: sql<number>`COUNT(DISTINCT ${factTags.tagId})`.as("tagCount"),
			})
			.from(factTags)
			.where(inArray(factTags.tagId, tagIds))
			.groupBy(factTags.factId);

		factIdsToVerify = factTagCounts
			.filter((f) => f.tagCount === tagIds.length)
			.map((f) => f.factId);
	} else {
		// Facts with ANY of the tags
		const factTagResults = await db
			.selectDistinct({ factId: factTags.factId })
			.from(factTags)
			.where(inArray(factTags.tagId, tagIds));
		factIdsToVerify = factTagResults.map((f) => f.factId);
	}

	if (factIdsToVerify.length === 0) {
		return { verified: 0, factIds: [] };
	}

	// Update verification status
	await db
		.update(facts)
		.set({
			verified: true,
			updatedAt: sql`(CURRENT_TIMESTAMP)`,
		})
		.where(inArray(facts.id, factIdsToVerify));

	return { verified: factIdsToVerify.length, factIds: factIdsToVerify };
}
