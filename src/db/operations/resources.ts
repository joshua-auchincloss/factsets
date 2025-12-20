import { eq, like, sql, inArray, lt, desc, asc } from "drizzle-orm";
import type { DB } from "../index.js";
import { resources, resourceTags, tags, skillResources } from "../schema.js";
import {
	getOrCreateTags,
	incrementTagUsage,
	getSuggestedTags,
} from "./tags.js";
import { computeHash } from "../../utils/hash.js";
import { nowISO, hoursAgoISO, secondsSince } from "../../utils/dates.js";
import { decodeCursor, getNextCursor } from "../../utils/cursor.js";
import type {
	ResourceAddInput,
	ResourceSearchInput,
	ResourceGetInput,
	ResourcesGetInput,
	ResourceAddOutput,
	ResourceSearchOutput,
	ResourceGetOutput,
	ResourcesGetOutput,
} from "../../schemas/resources.js";

export async function addResources(
	db: DB,
	input: ResourceAddInput,
): Promise<ResourceAddOutput> {
	if (input.resources.length === 0) {
		return { created: 0, resources: [] };
	}

	const allTagNames = [...new Set(input.resources.flatMap((r) => r.tags))];
	const tagMap = await getOrCreateTags(db, allTagNames);

	const uris = input.resources.map((r) => r.uri);
	const existingResources = await db
		.select({
			id: resources.id,
			uri: resources.uri,
			snapshot: resources.snapshot,
		})
		.from(resources)
		.where(inArray(resources.uri, uris));

	const existingUriMap = new Map(
		existingResources.map((r) => [
			r.uri,
			{ id: r.id, hasSnapshot: r.snapshot !== null },
		]),
	);
	const toInsert = input.resources.filter((r) => !existingUriMap.has(r.uri));

	const insertValues = toInsert.map((resource) => {
		const snapshot = resource.snapshot ?? null;
		const snapshotHash = snapshot ? computeHash(snapshot) : null;

		return {
			uri: resource.uri,
			type: resource.type,
			snapshot,
			snapshotHash,
			retrievalMethod: resource.retrievalMethod ?? null,
			lastVerifiedAt: snapshot ? nowISO() : null,
		};
	});

	let insertedResources: { id: number; uri: string }[] = [];
	if (insertValues.length > 0) {
		insertedResources = await db
			.insert(resources)
			.values(insertValues)
			.returning({ id: resources.id, uri: resources.uri });

		const resourceTagValues: { resourceId: number; tagId: number }[] = [];
		for (const inserted of insertedResources) {
			const resourceInput = toInsert.find((r) => r.uri === inserted.uri);
			if (resourceInput) {
				for (const tagName of resourceInput.tags) {
					const tagId = tagMap.get(tagName);
					if (tagId) {
						resourceTagValues.push({ resourceId: inserted.id, tagId });
					}
				}
			}
		}

		if (resourceTagValues.length > 0) {
			await db
				.insert(resourceTags)
				.values(resourceTagValues)
				.onConflictDoNothing();
		}
	}

	const snapshotMap = new Map(toInsert.map((r) => [r.uri, !!r.snapshot]));

	const allResults = [
		...insertedResources.map((r) => ({
			id: r.id,
			uri: r.uri,
			hasSnapshot: snapshotMap.get(r.uri) ?? false,
		})),
		...input.resources
			.filter((r) => existingUriMap.has(r.uri))
			.map((r) => {
				const existing = existingUriMap.get(r.uri)!;
				return {
					id: existing.id,
					uri: r.uri,
					hasSnapshot: existing.hasSnapshot,
				};
			}),
	];

	return {
		created: insertedResources.length,
		resources: allResults,
	};
}

export async function searchResources(
	db: DB,
	input: ResourceSearchInput,
): Promise<ResourceSearchOutput> {
	const limit = input.limit ?? 20;
	const tagIdsToIncrement: number[] = [];
	let tagIds: number[] = [];

	// Parse cursor for offset
	let offset = 0;
	if (input.cursor) {
		const cursorData = decodeCursor(input.cursor);
		if (!cursorData) {
			throw new Error("Invalid cursor");
		}
		offset = cursorData.offset;
	}

	if (input.tags && input.tags.length > 0) {
		const tagResults = await db
			.select({ id: tags.id })
			.from(tags)
			.where(inArray(tags.name, input.tags));

		if (tagResults.length === 0) {
			// No matching tags - suggest popular ones
			const suggestedTags = await getSuggestedTags(db, 5);
			return { resources: [], suggestedTags };
		}

		tagIds = tagResults.map((t) => t.id);
		tagIdsToIncrement.push(...tagIds);
	}

	// Build query for results
	let query = db
		.selectDistinct({
			id: resources.id,
			uri: resources.uri,
			type: resources.type,
			snapshot: resources.snapshot,
			lastVerifiedAt: resources.lastVerifiedAt,
		})
		.from(resources);

	// Apply tag join if needed
	if (tagIds.length > 0) {
		query = query
			.innerJoin(resourceTags, eq(resources.id, resourceTags.resourceId))
			.where(inArray(resourceTags.tagId, tagIds)) as unknown as typeof query;
	}

	if (input.type) {
		const typeCondition = eq(resources.type, input.type);
		query = query.where(typeCondition) as unknown as typeof query;
	}

	if (input.uriPattern) {
		const uriCondition = like(resources.uri, `%${input.uriPattern}%`);
		query = query.where(uriCondition) as unknown as typeof query;
	}

	// Apply ordering
	const orderBy = input.orderBy ?? "recent";
	switch (orderBy) {
		case "oldest":
			query = query.orderBy(
				asc(resources.createdAt),
			) as unknown as typeof query;
			break;
		case "fresh":
			query = query.orderBy(
				desc(resources.lastVerifiedAt),
			) as unknown as typeof query;
			break;
		case "recent":
		default:
			query = query.orderBy(
				desc(resources.createdAt),
			) as unknown as typeof query;
			break;
	}

	// Fetch limit + 1 to determine if there are more results
	const results = await query.offset(offset).limit(limit + 1);

	// Check if there are more results
	const hasMore = results.length > limit;
	const pageResults = hasMore ? results.slice(0, limit) : results;

	if (tagIdsToIncrement.length > 0) {
		await incrementTagUsage(db, tagIdsToIncrement);
	}

	const resourcesWithTags = await Promise.all(
		pageResults.map(async (resource) => {
			const resourceTagsResult = await db
				.select({ name: tags.name })
				.from(resourceTags)
				.innerJoin(tags, eq(resourceTags.tagId, tags.id))
				.where(eq(resourceTags.resourceId, resource.id));

			return {
				id: resource.id,
				uri: resource.uri,
				type: resource.type,
				tags: resourceTagsResult.map((t) => t.name),
				hasSnapshot: !!resource.snapshot,
				snapshotPreview: resource.snapshot?.slice(0, 200) ?? "",
				lastVerifiedAt: resource.lastVerifiedAt,
			};
		}),
	);

	// Include suggestedTags when results are empty
	if (resourcesWithTags.length === 0) {
		const suggestedTags = await getSuggestedTags(db, 5);
		return {
			resources: [],
			suggestedTags,
		};
	}

	return {
		resources: resourcesWithTags,
		nextCursor: getNextCursor(offset, limit, results.length),
	};
}

export async function getResource(
	db: DB,
	input: ResourceGetInput,
): Promise<ResourceGetOutput | null> {
	let resource: typeof resources.$inferSelect | undefined;

	if (input.id) {
		const result = await db
			.select()
			.from(resources)
			.where(eq(resources.id, input.id))
			.limit(1);

		resource = result[0];
	} else if (input.uri) {
		const result = await db
			.select()
			.from(resources)
			.where(eq(resources.uri, input.uri))
			.limit(1);
		resource = result[0];
	}

	if (!resource) {
		return null;
	}

	const snapshotAgeSeconds = resource.lastVerifiedAt
		? secondsSince(resource.lastVerifiedAt)
		: 0;

	// Use configurable maxAgeHours (default 1 hour = 3600 seconds)
	const thresholdSeconds = (input.maxAgeHours ?? 1) * 3600;

	await db
		.update(resources)
		.set({ retrievalCount: sql`${resources.retrievalCount} + 1` })
		.where(eq(resources.id, resource.id));

	return {
		uri: resource.uri,
		type: resource.type,
		content: resource.snapshot ?? "",
		isFresh: snapshotAgeSeconds < thresholdSeconds,
		snapshotAgeSeconds,
		retrievalMethod: resource.retrievalMethod,
	};
}

export async function getResources(
	db: DB,
	input: ResourcesGetInput,
): Promise<ResourcesGetOutput> {
	const thresholdSeconds = (input.maxAgeHours ?? 1) * 3600;
	const results: ResourcesGetOutput["resources"] = [];
	const notFound: (number | string)[] = [];

	// Fetch by IDs
	if (input.ids && input.ids.length > 0) {
		const found = await db
			.select()
			.from(resources)
			.where(inArray(resources.id, input.ids));

		const foundIds = new Set(found.map((r) => r.id));
		for (const id of input.ids) {
			if (!foundIds.has(id)) {
				notFound.push(id);
			}
		}

		for (const resource of found) {
			const snapshotAgeSeconds = resource.lastVerifiedAt
				? secondsSince(resource.lastVerifiedAt)
				: 0;

			results.push({
				id: resource.id,
				uri: resource.uri,
				type: resource.type,
				content: resource.snapshot ?? "",
				isFresh: snapshotAgeSeconds < thresholdSeconds,
				snapshotAgeSeconds,
				retrievalMethod: resource.retrievalMethod,
			});
		}

		// Increment retrieval counts
		if (found.length > 0) {
			await db
				.update(resources)
				.set({ retrievalCount: sql`${resources.retrievalCount} + 1` })
				.where(
					inArray(
						resources.id,
						found.map((r) => r.id),
					),
				);
		}
	}

	// Fetch by URIs
	if (input.uris && input.uris.length > 0) {
		const found = await db
			.select()
			.from(resources)
			.where(inArray(resources.uri, input.uris));

		const foundUris = new Set(found.map((r) => r.uri));
		for (const uri of input.uris) {
			if (!foundUris.has(uri)) {
				notFound.push(uri);
			}
		}

		for (const resource of found) {
			// Skip if already added by ID
			if (results.some((r) => r.id === resource.id)) {
				continue;
			}

			const snapshotAgeSeconds = resource.lastVerifiedAt
				? secondsSince(resource.lastVerifiedAt)
				: 0;

			results.push({
				id: resource.id,
				uri: resource.uri,
				type: resource.type,
				content: resource.snapshot ?? "",
				isFresh: snapshotAgeSeconds < thresholdSeconds,
				snapshotAgeSeconds,
				retrievalMethod: resource.retrievalMethod,
			});
		}

		// Increment retrieval counts
		if (found.length > 0) {
			await db
				.update(resources)
				.set({ retrievalCount: sql`${resources.retrievalCount} + 1` })
				.where(
					inArray(
						resources.id,
						found.map((r) => r.id),
					),
				);
		}
	}

	return { resources: results, notFound };
}

export async function updateResourceSnapshot(
	db: DB,
	input: { id?: number; uri?: string; snapshot: string },
): Promise<void> {
	const snapshotHash = computeHash(input.snapshot);
	const now = nowISO();

	if (input.id) {
		await db
			.update(resources)
			.set({
				snapshot: input.snapshot,
				snapshotHash,
				lastVerifiedAt: now,
				updatedAt: sql`(CURRENT_TIMESTAMP)`,
			})
			.where(eq(resources.id, input.id));
	} else if (input.uri) {
		await db
			.update(resources)
			.set({
				snapshot: input.snapshot,
				snapshotHash,
				lastVerifiedAt: now,
				updatedAt: sql`(CURRENT_TIMESTAMP)`,
			})
			.where(eq(resources.uri, input.uri));
	}
}

export async function updateResourceSnapshots(
	db: DB,
	inputs: Array<{ resourceId: number; snapshot: string }>,
): Promise<{ updated: number }> {
	if (inputs.length === 0) {
		return { updated: 0 };
	}

	const now = nowISO();
	let updated = 0;

	for (const input of inputs) {
		const snapshotHash = computeHash(input.snapshot);
		const result = await db
			.update(resources)
			.set({
				snapshot: input.snapshot,
				snapshotHash,
				lastVerifiedAt: now,
				updatedAt: sql`(CURRENT_TIMESTAMP)`,
			})
			.where(eq(resources.id, input.resourceId));

		if (result.changes > 0) {
			updated++;
		}
	}

	return { updated };
}

export async function getStaleResources(
	db: DB,
	staleHours: number,
): Promise<
	{
		id: number;
		uri: string;
		type: string;
		retrievalMethod: typeof resources.retrievalMethod._.data | null;
		lastVerifiedAt: string | null;
	}[]
> {
	const cutoff = hoursAgoISO(staleHours);

	return db
		.select({
			id: resources.id,
			uri: resources.uri,
			type: resources.type,
			retrievalMethod: resources.retrievalMethod,
			lastVerifiedAt: resources.lastVerifiedAt,
		})
		.from(resources)
		.where(lt(resources.lastVerifiedAt, cutoff));
}

export async function getResourceById(db: DB, id: number) {
	const result = await db
		.select()
		.from(resources)
		.where(eq(resources.id, id))
		.limit(1);
	return result[0] ?? null;
}

export async function deleteResources(
	db: DB,
	input: { ids?: number[]; uris?: string[] },
): Promise<{ deleted: number }> {
	const conditions = [];

	if (input.ids && input.ids.length > 0) {
		conditions.push(inArray(resources.id, input.ids));
	}

	if (input.uris && input.uris.length > 0) {
		conditions.push(inArray(resources.uri, input.uris));
	}

	if (conditions.length === 0) {
		return { deleted: 0 };
	}

	// Find all matching resources first
	const matchingResources = await db
		.select({ id: resources.id })
		.from(resources)
		.where(
			conditions.length === 1
				? conditions[0]
				: sql`${conditions[0]} OR ${conditions[1]}`,
		);

	if (matchingResources.length === 0) {
		return { deleted: 0 };
	}

	const resourceIds = matchingResources.map((r) => r.id);

	// Delete from junction tables first
	await db
		.delete(resourceTags)
		.where(inArray(resourceTags.resourceId, resourceIds));
	await db
		.delete(skillResources)
		.where(inArray(skillResources.resourceId, resourceIds));

	// Delete resources
	const result = await db
		.delete(resources)
		.where(inArray(resources.id, resourceIds))
		.returning({ id: resources.id });

	return { deleted: result.length };
}
