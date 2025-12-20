import { z } from "zod";

const resourceType = z.enum(["file", "url", "api", "command"]);

const retrievalMethod = z.object({
	type: z.string(),
	command: z.string().optional(),
	url: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
});

export const resourceAddInput = z.object({
	resources: z
		.array(
			z.object({
				uri: z.string().min(1),
				type: resourceType,
				tags: z.array(z.string().min(1)),
				snapshot: z.string().optional(),
				retrievalMethod: retrievalMethod.optional(),
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
		id: z.number().int().positive().optional(),
		uri: z.string().optional(),
		snapshot: z.string().min(1),
	})
	.refine((data) => data.id !== undefined || data.uri !== undefined, {
		message: "Either id or uri must be provided",
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

export const resourceDeleteInput = z
	.object({
		ids: z.array(z.number().int().positive()).optional(),
		uris: z.array(z.string()).optional(),
	})
	.refine(
		(data) =>
			(data.ids && data.ids.length > 0) || (data.uris && data.uris.length > 0),
		{
			message: "Either ids or uris must be provided",
		},
	);

export const resourceAddOutput = z.object({
	created: z.number(),
	resources: z.array(
		z.object({
			id: z.number(),
			uri: z.string(),
			hasSnapshot: z.boolean(),
		}),
	),
});

export const resourceSearchOutput = z.object({
	resources: z.array(
		z.object({
			id: z.number(),
			uri: z.string(),
			type: z.string(),
			tags: z.array(z.string()),
			hasSnapshot: z.boolean(),
			snapshotPreview: z.string(),
			lastVerifiedAt: z.string().nullable(),
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
export type ResourceDeleteInput = z.infer<typeof resourceDeleteInput>;
export type ResourceAddOutput = z.infer<typeof resourceAddOutput>;
export type ResourceSearchOutput = z.infer<typeof resourceSearchOutput>;
export type ResourceGetOutput = z.infer<typeof resourceGetOutput>;
export type ResourcesGetOutput = z.infer<typeof resourcesGetOutput>;
