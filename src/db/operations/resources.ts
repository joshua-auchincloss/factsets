import {
	eq,
	like,
	sql,
	inArray,
	lt,
	desc,
	asc,
	and,
	isNull,
} from "drizzle-orm";
import type { DB } from "../index.js";
import { resources, resourceTags, tags, skillResources } from "../schema.js";
import {
	getOrCreateTags,
	incrementTagUsage,
	getSuggestedTags,
} from "./tags.js";
import { expandTags, validateRequiredTags } from "./tag-relationships.js";
import {
	getSearchLimit,
	getSearchIncludeDeleted,
	getSnapshotMaxSizeKb,
	getSnapshotOverflowBehavior,
} from "./config.js";
import { computeHash } from "../../utils/hash.js";
import TurndownService from "turndown";
import { nowISO, hoursAgoISO, secondsSince } from "../../utils/dates.js";
import { decodeCursor, getNextCursor } from "../../utils/cursor.js";
import {
	inferResourceCategory,
	getFreshnessForCategories,
	type FreshnessCategory,
} from "../../runtime-config.js";
import type {
	ResourceAddInput,
	ResourceSearchInput,
	ResourceGetInput,
	ResourcesGetInput,
	ResourceUpdateInput,
	ResourceAddOutput,
	ResourceSearchOutput,
	ResourceGetOutput,
	ResourcesGetOutput,
	ResourceUpdateOutput,
} from "../../schemas/resources.js";

/**
 * Overflow behavior specification from the agent
 */
interface OverflowBehavior {
	behavior: "truncate" | "remove_noise" | "html_to_md" | "ignore";
	noisePatterns?: string[];
}

/**
 * Result of processing a snapshot with overflow handling
 */
interface SnapshotProcessResult {
	snapshot: string | null;
	needsResubmission: boolean;
	currentSizeKb?: number;
	maxSizeKb?: number;
}

/**
 * Process a snapshot according to size limits and overflow behavior.
 * If snapshot exceeds limit and no overflow behavior is specified,
 * falls back to config-based default. If config default is 'auto' or 'summarize',
 * returns needsResubmission=true so agent can decide how to handle.
 */
async function processSnapshot(
	db: DB,
	snapshot: string | null | undefined,
	overflowBehavior?: OverflowBehavior,
): Promise<SnapshotProcessResult> {
	if (!snapshot) {
		return { snapshot: null, needsResubmission: false };
	}

	const maxSizeKb = await getSnapshotMaxSizeKb(db);
	const maxSizeBytes = maxSizeKb * 1024;
	const snapshotBytes = Buffer.byteLength(snapshot, "utf8");
	const currentSizeKb = Math.ceil(snapshotBytes / 1024);

	// Under limit, return as-is
	if (snapshotBytes <= maxSizeBytes) {
		return { snapshot, needsResubmission: false };
	}

	// If no overflow behavior specified, check config default
	let effectiveBehavior = overflowBehavior;
	if (!effectiveBehavior) {
		const configDefault = await getSnapshotOverflowBehavior(db);
		// Config values 'summarize' and 'auto' mean we should ask the agent
		if (configDefault === "summarize" || configDefault === "auto") {
			return {
				snapshot: null,
				needsResubmission: true,
				currentSizeKb,
				maxSizeKb,
			};
		}
		// Map config values to behavior
		if (configDefault === "truncate") {
			effectiveBehavior = { behavior: "truncate" };
		} else if (configDefault === "remove_noise") {
			// Config-based remove_noise uses default patterns
			effectiveBehavior = {
				behavior: "remove_noise",
				noisePatterns: ["\\n{3,}", "[ \\t]+\\n", "^\\s+$"],
			};
		}
	}

	// Still no behavior after config check - request resubmission
	if (!effectiveBehavior) {
		return {
			snapshot: null,
			needsResubmission: true,
			currentSizeKb,
			maxSizeKb,
		};
	}

	switch (effectiveBehavior.behavior) {
		case "truncate":
			// Simple truncation to max size, add marker
			return {
				snapshot: snapshot.slice(0, maxSizeBytes - 50) + "\n\n[...truncated]",
				needsResubmission: false,
			};

		case "remove_noise": {
			// Apply regex patterns to remove noise
			let cleaned = snapshot;
			if (effectiveBehavior.noisePatterns) {
				for (const pattern of effectiveBehavior.noisePatterns) {
					try {
						const regex = new RegExp(pattern, "gm");
						cleaned = cleaned.replace(regex, "");
					} catch {
						// Invalid regex, skip it
					}
				}
			}
			cleaned = cleaned.trim();

			// If still too large after noise removal, request resubmission
			if (Buffer.byteLength(cleaned, "utf8") > maxSizeBytes) {
				return {
					snapshot: null,
					needsResubmission: true,
					currentSizeKb: Math.ceil(Buffer.byteLength(cleaned, "utf8") / 1024),
					maxSizeKb,
				};
			}
			return { snapshot: cleaned, needsResubmission: false };
		}

		case "html_to_md": {
			// Convert HTML to markdown using turndown
			const turndown = new TurndownService({
				headingStyle: "atx",
				codeBlockStyle: "fenced",
			});
			const markdown = turndown.turndown(snapshot);

			// Check if result fits within limit
			if (Buffer.byteLength(markdown, "utf8") <= maxSizeBytes) {
				return { snapshot: markdown, needsResubmission: false };
			}

			// Still too large after conversion, request resubmission
			return {
				snapshot: null,
				needsResubmission: true,
				currentSizeKb: Math.ceil(Buffer.byteLength(markdown, "utf8") / 1024),
				maxSizeKb,
			};
		}

		case "ignore":
			// Store as-is regardless of size - agent has determined this is critical
			return { snapshot, needsResubmission: false };

		default:
			return {
				snapshot: null,
				needsResubmission: true,
				currentSizeKb,
				maxSizeKb,
			};
	}
}

/**
 * Generate an overflow prompt for the agent
 */
function generateOverflowPrompt(
	uri: string,
	currentSizeKb: number,
	maxSizeKb: number,
): {
	uri: string;
	currentSizeKb: number;
	maxSizeKb: number;
	message: string;
	suggestedActions: Array<{
		behavior: "truncate" | "remove_noise" | "html_to_md" | "ignore";
		description: string;
	}>;
} {
	return {
		uri,
		currentSizeKb,
		maxSizeKb,
		message: `Snapshot for resource "${uri}" exceeds the ${maxSizeKb}KB limit (current: ${currentSizeKb}KB). Please resubmit with one of the overflow behaviors, or provide a pre-summarized snapshot.`,
		suggestedActions: [
			{
				behavior: "truncate" as const,
				description:
					"Simple truncation - keeps the first portion up to the size limit",
			},
			{
				behavior: "remove_noise" as const,
				description:
					"Apply regex patterns to remove noise (e.g., comments, whitespace). Provide noisePatterns array with regex strings.",
			},
			{
				behavior: "html_to_md" as const,
				description:
					"Convert HTML content to Markdown. Useful for web page snapshots where HTML markup adds significant overhead.",
			},
			{
				behavior: "ignore" as const,
				description:
					"Store the full content regardless of size. Use for information-dense content where truncation would lose critical context.",
			},
		],
	};
}

export async function addResources(
	db: DB,
	input: ResourceAddInput,
): Promise<ResourceAddOutput> {
	if (input.resources.length === 0) {
		return { created: 0, resources: [] };
	}

	// Validate required tags for each resource
	for (const resource of input.resources) {
		const validation = await validateRequiredTags(
			db,
			"resources",
			resource.tags,
		);
		if (!validation.valid) {
			throw new Error(
				`Required tags missing for resource ${resource.uri}: ${validation.missing.join(", ")}`,
			);
		}
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

	// Process snapshots with size limits, track overflow prompts
	const overflowPrompts: Array<{
		uri: string;
		currentSizeKb: number;
		maxSizeKb: number;
		message: string;
		suggestedActions: Array<{
			behavior: "truncate" | "remove_noise" | "html_to_md" | "ignore";
			description: string;
		}>;
	}> = [];

	const processedResources: Array<{
		resource: (typeof toInsert)[0];
		snapshotResult: SnapshotProcessResult;
	}> = [];

	for (const resource of toInsert) {
		const snapshotResult = await processSnapshot(
			db,
			resource.snapshot,
			resource.overflowBehavior,
		);

		if (snapshotResult.needsResubmission) {
			overflowPrompts.push(
				generateOverflowPrompt(
					resource.uri,
					snapshotResult.currentSizeKb!,
					snapshotResult.maxSizeKb!,
				),
			);
		}

		processedResources.push({ resource, snapshotResult });
	}

	// Only insert resources that don't need resubmission
	const toActuallyInsert = processedResources.filter(
		(p) => !p.snapshotResult.needsResubmission,
	);

	const insertValues = toActuallyInsert.map(({ resource, snapshotResult }) => {
		const snapshot = snapshotResult.snapshot;
		const snapshotHash = snapshot ? computeHash(snapshot) : null;

		return {
			uri: resource.uri,
			type: resource.type,
			description: resource.description,
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

	// Build snapshot map from processed results (not original inputs)
	const snapshotMap = new Map(
		toActuallyInsert.map(({ resource, snapshotResult }) => [
			resource.uri,
			!!snapshotResult.snapshot,
		]),
	);

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

	const result: ResourceAddOutput = {
		created: insertedResources.length,
		resources: allResults,
	};

	// Include overflow prompts if any resources need resubmission
	if (overflowPrompts.length > 0) {
		result.overflowPrompts = overflowPrompts;
	}

	return result;
}

export async function searchResources(
	db: DB,
	input: ResourceSearchInput,
): Promise<ResourceSearchOutput> {
	// Use config-based default limit if not provided
	const configLimit = await getSearchLimit(db, "resources");
	const limit = input.limit ?? configLimit;
	const tagIdsToIncrement: number[] = [];
	let tagIds: number[] = [];

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
		: [isNull(resources.deletedAt)];

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
			return { resources: [], suggestedTags };
		}

		tagIds = tagResults.map((t) => t.id);
		tagIdsToIncrement.push(...tagIds);
	}

	// Add type filter
	if (input.type) {
		conditions.push(eq(resources.type, input.type));
	}

	// Add URI pattern filter
	if (input.uriPattern) {
		conditions.push(like(resources.uri, `%${input.uriPattern}%`));
	}

	// Build query for results
	let query = db
		.selectDistinct({
			id: resources.id,
			uri: resources.uri,
			type: resources.type,
			description: resources.description,
			snapshot: resources.snapshot,
			lastVerifiedAt: resources.lastVerifiedAt,
		})
		.from(resources);

	// Apply tag join and all conditions
	if (tagIds.length > 0) {
		query = query
			.innerJoin(resourceTags, eq(resources.id, resourceTags.resourceId))
			.where(
				and(inArray(resourceTags.tagId, tagIds), ...conditions),
			) as unknown as typeof query;
	} else {
		query = query.where(and(...conditions)) as unknown as typeof query;
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

			// Infer categories and use minimum threshold (strictest wins)
			const categories = inferResourceCategory(
				resource.uri,
			) as FreshnessCategory[];
			const freshnessThresholdHours = getFreshnessForCategories(categories);

			return {
				id: resource.id,
				uri: resource.uri,
				type: resource.type,
				description: resource.description,
				tags: resourceTagsResult.map((t) => t.name),
				hasSnapshot: !!resource.snapshot,
				snapshotPreview: resource.snapshot?.slice(0, 200) ?? "",
				lastVerifiedAt: resource.lastVerifiedAt,
				categories,
				freshnessThresholdHours,
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

	// Infer categories and use minimum threshold (strictest wins)
	const categories = inferResourceCategory(resource.uri) as FreshnessCategory[];
	const freshnessThresholdHours = getFreshnessForCategories(categories);

	// Use category-specific threshold, but allow override via maxAgeHours if provided
	const effectiveThresholdHours = input.maxAgeHours ?? freshnessThresholdHours;
	const thresholdSeconds = effectiveThresholdHours * 3600;

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
		categories,
		freshnessThresholdHours,
	};
}

export async function getResources(
	db: DB,
	input: ResourcesGetInput,
): Promise<ResourcesGetOutput> {
	// maxAgeHours can be provided as override, otherwise we use per-resource category thresholds
	const overrideMaxAgeHours = input.maxAgeHours;
	const results: ResourcesGetOutput["resources"] = [];
	const notFound: (number | string)[] = [];

	// Helper to compute freshness for a resource
	const computeResourceFreshness = (
		resource: typeof resources.$inferSelect,
	) => {
		const snapshotAgeSeconds = resource.lastVerifiedAt
			? secondsSince(resource.lastVerifiedAt)
			: 0;

		// Infer categories and use minimum threshold (strictest wins)
		const categories = inferResourceCategory(
			resource.uri,
		) as FreshnessCategory[];
		const freshnessThresholdHours = getFreshnessForCategories(categories);
		const effectiveThresholdHours =
			overrideMaxAgeHours ?? freshnessThresholdHours;
		const thresholdSeconds = effectiveThresholdHours * 3600;

		return {
			id: resource.id,
			uri: resource.uri,
			type: resource.type,
			content: resource.snapshot ?? "",
			isFresh: snapshotAgeSeconds < thresholdSeconds,
			snapshotAgeSeconds,
			retrievalMethod: resource.retrievalMethod,
			categories,
			freshnessThresholdHours,
		};
	};

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
			results.push(computeResourceFreshness(resource));
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

			results.push(computeResourceFreshness(resource));
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
	// Process snapshot with size limits - use truncate as default for updates
	const result = await processSnapshot(db, input.snapshot, {
		behavior: "truncate",
	});
	if (!result.snapshot) return;

	const snapshotHash = computeHash(result.snapshot);
	const now = nowISO();

	if (input.id) {
		await db
			.update(resources)
			.set({
				snapshot: result.snapshot,
				snapshotHash,
				lastVerifiedAt: now,
				updatedAt: sql`(CURRENT_TIMESTAMP)`,
			})
			.where(eq(resources.id, input.id));
	} else if (input.uri) {
		await db
			.update(resources)
			.set({
				snapshot: result.snapshot,
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
		// Process snapshot with size limits - use truncate as default for updates
		const processResult = await processSnapshot(db, input.snapshot, {
			behavior: "truncate",
		});
		if (!processResult.snapshot) continue;

		const snapshotHash = computeHash(processResult.snapshot);
		const result = await db
			.update(resources)
			.set({
				snapshot: processResult.snapshot,
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

export async function updateResource(
	db: DB,
	input: ResourceUpdateInput,
): Promise<ResourceUpdateOutput> {
	// Find the resource
	let resourceRecord: typeof resources.$inferSelect | undefined;

	if (input.id) {
		const result = await db
			.select()
			.from(resources)
			.where(eq(resources.id, input.id))
			.limit(1);
		resourceRecord = result[0];
	} else if (input.uri) {
		const result = await db
			.select()
			.from(resources)
			.where(eq(resources.uri, input.uri))
			.limit(1);
		resourceRecord = result[0];
	}

	if (!resourceRecord) {
		throw new Error(
			`Resource not found: ${input.id ? `id=${input.id}` : `uri=${input.uri}`}`,
		);
	}

	const resourceId = resourceRecord.id;

	// Build update object - only metadata fields, NOT snapshot-related fields
	const updates: Partial<typeof resources.$inferInsert> = {};

	if (input.description !== undefined) {
		updates.description = input.description;
	}

	if (input.retrievalMethod !== undefined) {
		updates.retrievalMethod = input.retrievalMethod;
	}

	// Apply metadata updates if any
	if (Object.keys(updates).length > 0) {
		await db.update(resources).set(updates).where(eq(resources.id, resourceId));
	}

	// Handle tag replacement
	if (input.tags) {
		// Remove all existing tags
		await db
			.delete(resourceTags)
			.where(eq(resourceTags.resourceId, resourceId));

		// Add new tags
		if (input.tags.length > 0) {
			const tagMap = await getOrCreateTags(db, input.tags);
			const tagValues = Array.from(tagMap.values()).map((tagId) => ({
				resourceId,
				tagId,
			}));
			await db.insert(resourceTags).values(tagValues).onConflictDoNothing();
		}
	}

	// Handle tag append
	if (input.appendTags?.length) {
		const tagMap = await getOrCreateTags(db, input.appendTags);
		const tagValues = Array.from(tagMap.values()).map((tagId) => ({
			resourceId,
			tagId,
		}));
		await db.insert(resourceTags).values(tagValues).onConflictDoNothing();
	}

	return { success: true, id: resourceId };
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
	input: { ids?: number[]; uris?: string[]; soft?: boolean },
): Promise<{ deleted: number }> {
	const conditions = [];

	// Exclude already deleted resources
	conditions.push(sql`${resources.deletedAt} IS NULL`);

	if (input.ids && input.ids.length > 0) {
		conditions.push(inArray(resources.id, input.ids));
	}

	if (input.uris && input.uris.length > 0) {
		conditions.push(inArray(resources.uri, input.uris));
	}

	if (conditions.length <= 1) {
		return { deleted: 0 };
	}

	// Build the where condition
	const idOrUriCondition =
		conditions.length === 2
			? conditions[1]
			: sql`(${conditions[1]} OR ${conditions[2]})`;
	const fullCondition = and(conditions[0], idOrUriCondition);

	// Find all matching resources first
	const matchingResources = await db
		.select({ id: resources.id })
		.from(resources)
		.where(fullCondition);

	if (matchingResources.length === 0) {
		return { deleted: 0 };
	}

	const resourceIds = matchingResources.map((r) => r.id);

	// Soft delete: set deletedAt timestamp
	if (input.soft) {
		const result = await db
			.update(resources)
			.set({ deletedAt: sql`(CURRENT_TIMESTAMP)` as unknown as string })
			.where(inArray(resources.id, resourceIds))
			.returning({ id: resources.id });
		return { deleted: result.length };
	}

	// Hard delete: remove from junction tables first
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

export async function restoreResources(
	db: DB,
	ids: number[],
): Promise<{ restored: number }> {
	if (ids.length === 0) {
		return { restored: 0 };
	}

	const result = await db
		.update(resources)
		.set({ deletedAt: null })
		.where(
			and(inArray(resources.id, ids), sql`${resources.deletedAt} IS NOT NULL`),
		)
		.returning({ id: resources.id });

	return { restored: result.length };
}
