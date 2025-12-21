import { z } from "zod";
import { PLACEHOLDER_DESCRIPTION } from "../constants.js";
import { freshnessCategory } from "./context.js";

const resourceType = z.enum(["file", "url", "api", "command"]);

const retrievalMethod = z.object({
	type: z.string(),
	command: z.string().optional(),
	url: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
});

/**
 * Overflow behavior options for snapshots that exceed size limits:
 * - truncate: Simple truncation to max size
 * - remove_noise: Apply regex patterns to remove noise before storing
 * - html_to_md: Convert HTML content to markdown using turndown
 * - ignore: Store as-is regardless of size (for dense/critical content)
 */
const snapshotOverflowBehavior = z.object({
	behavior: z.enum(["truncate", "remove_noise", "html_to_md", "ignore"]),
	noisePatterns: z
		.array(z.string())
		.optional()
		.describe(
			"Regex patterns to remove when behavior is 'remove_noise'. Each pattern is applied globally.",
		),
});

export const resourceAddInput = z.object({
	resources: z
		.array(
			z.object({
				uri: z.string().min(1),
				type: resourceType,
				description: z
					.string()
					.min(1)
					.default(PLACEHOLDER_DESCRIPTION)
					.describe(
						"Description of what this resource contains. Agents should always provide meaningful descriptions to enable search and avoid duplicates.",
					),
				tags: z.array(z.string().min(1)),
				snapshot: z.string().optional(),
				retrievalMethod: retrievalMethod.optional(),
				overflowBehavior: snapshotOverflowBehavior
					.optional()
					.describe(
						"How to handle snapshots that exceed size limits. If not provided and snapshot exceeds limit, a resubmission prompt will be returned.",
					),
			}),
		)
		.min(1),
});

export const resourceSearchInput = z.object({
	tags: z.array(z.string()).optional(),
	type: resourceType.optional(),
	uriPattern: z.string().optional(),
	limit: z.number().int().positive().default(100).optional(),
	cursor: z.string().optional().describe("Opaque cursor for pagination"),
	orderBy: z.enum(["recent", "oldest", "fresh"]).default("recent").optional(),
});

export const resourceGetInput = z
	.object({
		id: z.number().int().positive().optional(),
		uri: z.string().optional(),
		maxAgeHours: z
			.number()
			.int()
			.positive()
			.default(1)
			.optional()
			.describe("Hours before content is considered stale (default: 1)"),
	})
	.refine((data) => data.id !== undefined || data.uri !== undefined, {
		message: "Either id or uri must be provided",
	});

export const resourcesGetInput = z
	.object({
		ids: z.array(z.number().int().positive()).optional(),
		uris: z.array(z.string()).optional(),
		maxAgeHours: z
			.number()
			.int()
			.positive()
			.default(1)
			.optional()
			.describe("Hours before content is considered stale (default: 1)"),
	})
	.refine(
		(data) =>
			(data.ids && data.ids.length > 0) || (data.uris && data.uris.length > 0),
		{
			message: "Either ids or uris must be provided",
		},
	);

export const resourceUpdateSnapshotInput = z
	.object({
		id: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Resource ID (required if uri not provided)"),
		uri: z
			.string()
			.optional()
			.describe("Resource URI (required if id not provided)"),
		snapshot: z.string().min(1).describe("The new snapshot content"),
	})
	.superRefine((data, ctx) => {
		if (data.id === undefined && data.uri === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Either id or uri must be provided",
				path: [],
			});
		}
	});

export const resourceUpdateSnapshotsInput = z.object({
	snapshots: z
		.array(
			z.object({
				resourceId: z.number().int().positive(),
				snapshot: z.string().min(1),
			}),
		)
		.min(1),
});

export const resourceUpdateInput = z
	.object({
		id: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Resource ID (required if uri not provided)"),
		uri: z
			.string()
			.optional()
			.describe("Resource URI (required if id not provided)"),
		description: z
			.string()
			.min(1)
			.optional()
			.describe("New description for the resource"),
		tags: z
			.array(z.string().min(1))
			.optional()
			.describe("Replace all tags with this list"),
		appendTags: z
			.array(z.string().min(1))
			.optional()
			.describe("Add these tags without removing existing ones"),
		retrievalMethod: z
			.object({
				type: z.string(),
				command: z.string().optional(),
				url: z.string().optional(),
				headers: z.record(z.string(), z.string()).optional(),
			})
			.optional()
			.describe("Update the retrieval method for refreshing this resource"),
	})
	.describe(
		"Update resource metadata (description, tags, retrieval method) without modifying snapshot or timestamp fields.",
	)
	.superRefine((data, ctx) => {
		if (data.id === undefined && data.uri === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Either id or uri must be provided",
				path: [],
			});
		}
		if (
			data.description === undefined &&
			data.tags === undefined &&
			data.appendTags === undefined &&
			data.retrievalMethod === undefined
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"At least one of description, tags, appendTags, or retrievalMethod must be provided",
				path: [],
			});
		}
	});

export const resourceDeleteInput = z
	.object({
		ids: z
			.array(z.number().int().positive())
			.min(1)
			.optional()
			.describe(
				"Resource IDs to delete. CONDITIONALLY REQUIRED: provide either ids or uris (or both)",
			),
		uris: z
			.array(z.string().min(1))
			.min(1)
			.optional()
			.describe(
				"Resource URIs to delete. CONDITIONALLY REQUIRED: provide either ids or uris (or both)",
			),
		soft: z
			.boolean()
			.default(false)
			.optional()
			.describe("If true, soft delete (set deletedAt) instead of hard delete"),
	})
	.describe(
		"Delete resources by ID or URI. Either ids or uris must be provided (or both).",
	)
	.superRefine((data, ctx) => {
		if (
			(!data.ids || data.ids.length === 0) &&
			(!data.uris || data.uris.length === 0)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Either ids or uris must be provided",
				path: [],
			});
		}
	});

export const resourceRestoreInput = z.object({
	ids: z
		.array(z.number().int().positive())
		.min(1)
		.describe("IDs of soft-deleted resources to restore"),
});

export const resourceRestoreOutput = z.object({
	restored: z.number().describe("Number of resources restored"),
});

export const resourceUpdateSnapshotOutput = z.object({
	success: z.literal(true),
});

export const resourceUpdateSnapshotsOutput = z.object({
	updated: z.number().describe("Number of snapshots updated"),
});

export const resourceUpdateOutput = z.object({
	id: z.number(),
	success: z.boolean(),
});

export const resourceDeleteOutput = z.object({
	deleted: z.number().describe("Number of resources deleted"),
});

export const resourceAddOutput = z.object({
	created: z.number(),
	resources: z.array(
		z.object({
			id: z.number(),
			uri: z.string(),
			hasSnapshot: z.boolean(),
		}),
	),
	overflowPrompts: z
		.array(
			z.object({
				uri: z
					.string()
					.describe("URI of the resource that exceeded size limit"),
				currentSizeKb: z.number().describe("Current snapshot size in KB"),
				maxSizeKb: z.number().describe("Configured maximum size in KB"),
				message: z
					.string()
					.describe("Instruction for the agent on how to resubmit"),
				suggestedActions: z
					.array(
						z.object({
							behavior: z.enum([
								"truncate",
								"remove_noise",
								"html_to_md",
								"ignore",
							]),
							description: z.string(),
						}),
					)
					.describe("Available overflow behaviors the agent can choose"),
			}),
		)
		.optional()
		.describe(
			"Resources that exceeded size limits and need resubmission with overflow handling",
		),
});

export const resourceSearchOutput = z.object({
	resources: z.array(
		z.object({
			id: z.number(),
			uri: z.string(),
			type: z.string(),
			description: z.string().nullable(),
			tags: z.array(z.string()),
			hasSnapshot: z.boolean(),
			snapshotPreview: z.string(),
			lastVerifiedAt: z.string().nullable(),
			categories: z
				.array(freshnessCategory)
				.describe("All matched resource categories"),
			freshnessThresholdHours: z
				.number()
				.describe("Minimum freshness threshold in hours across all categories"),
		}),
	),
	nextCursor: z
		.string()
		.optional()
		.describe("Opaque cursor for next page, absent if no more results"),
	suggestedTags: z
		.array(z.string())
		.optional()
		.describe("Popular tags to explore when search returns empty results"),
});

export const resourceGetOutput = z.object({
	uri: z.string(),
	type: z.string(),
	content: z.string(),
	isFresh: z.boolean(),
	snapshotAgeSeconds: z.number(),
	retrievalMethod: retrievalMethod.nullable(),
	categories: z
		.array(freshnessCategory)
		.describe("All matched resource categories"),
	freshnessThresholdHours: z
		.number()
		.describe("Minimum freshness threshold in hours across all categories"),
});

export const resourcesGetOutput = z.object({
	resources: z.array(
		z.object({
			id: z.number(),
			uri: z.string(),
			type: z.string(),
			content: z.string(),
			isFresh: z.boolean(),
			snapshotAgeSeconds: z.number(),
			retrievalMethod: retrievalMethod.nullable(),
			categories: z
				.array(freshnessCategory)
				.describe("All matched resource categories"),
			freshnessThresholdHours: z
				.number()
				.describe("Minimum freshness threshold in hours across all categories"),
		}),
	),
	notFound: z.array(z.union([z.number(), z.string()])),
});

export type ResourceAddInput = z.infer<typeof resourceAddInput>;
export type ResourceSearchInput = z.infer<typeof resourceSearchInput>;
export type ResourceGetInput = z.infer<typeof resourceGetInput>;
export type ResourcesGetInput = z.infer<typeof resourcesGetInput>;
export type ResourceUpdateSnapshotInput = z.infer<
	typeof resourceUpdateSnapshotInput
>;
export type ResourceUpdateSnapshotsInput = z.infer<
	typeof resourceUpdateSnapshotsInput
>;
export type ResourceUpdateInput = z.infer<typeof resourceUpdateInput>;
export type ResourceDeleteInput = z.infer<typeof resourceDeleteInput>;
export type ResourceRestoreInput = z.infer<typeof resourceRestoreInput>;
export type ResourceAddOutput = z.infer<typeof resourceAddOutput>;
export type ResourceSearchOutput = z.infer<typeof resourceSearchOutput>;
export type ResourceGetOutput = z.infer<typeof resourceGetOutput>;
export type ResourcesGetOutput = z.infer<typeof resourcesGetOutput>;
export type ResourceRestoreOutput = z.infer<typeof resourceRestoreOutput>;
export type ResourceUpdateSnapshotOutput = z.infer<
	typeof resourceUpdateSnapshotOutput
>;
export type ResourceUpdateSnapshotsOutput = z.infer<
	typeof resourceUpdateSnapshotsOutput
>;
export type ResourceUpdateOutput = z.infer<typeof resourceUpdateOutput>;
export type ResourceDeleteOutput = z.infer<typeof resourceDeleteOutput>;
