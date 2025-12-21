import { z } from "zod";

export const tagListInput = z.object({
	filter: z.string().optional(),
	limit: z.number().int().positive().default(100).optional(),
	orderBy: z.enum(["usage", "name", "recent"]).default("usage").optional(),
});

export const tagCreateInput = z.object({
	tags: z
		.array(
			z.object({
				name: z.string().min(1),
				description: z
					.string()
					.min(1)
					.describe("Required description for the tag"),
			}),
		)
		.min(1),
});

export const tagOutput = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string(),
	usageCount: z.number(),
});

export const tagListOutput = z.object({
	tags: z.array(tagOutput),
});

export const tagCreateOutput = z.object({
	created: z.number(),
	tags: z.array(
		z.object({
			id: z.number(),
			name: z.string(),
		}),
	),
});

export const tagPruneOrphansInput = z.object({
	dryRun: z
		.boolean()
		.default(false)
		.optional()
		.describe(
			"If true, only return count of orphan tags without deleting them",
		),
});

export const tagPruneOrphansOutput = z.object({
	pruned: z
		.number()
		.describe("Number of orphan tags deleted (or would be deleted in dry run)"),
	orphanTags: z
		.array(z.object({ id: z.number(), name: z.string() }))
		.optional()
		.describe("List of orphan tags (only returned in dry run mode)"),
});

export const tagUpdateInput = z.object({
	updates: z
		.array(
			z.object({
				name: z.string().min(1).describe("Name of the tag to update"),
				description: z.string().min(1).describe("New description for the tag"),
			}),
		)
		.min(1)
		.describe("Array of tag updates with name and new description"),
});

export const tagUpdateOutput = z.object({
	updated: z.number().describe("Number of tags updated"),
	tags: z.array(
		z.object({
			id: z.number(),
			name: z.string(),
			description: z.string(),
		}),
	),
});

export type TagListInput = z.infer<typeof tagListInput>;
export type TagCreateInput = z.infer<typeof tagCreateInput>;
export type TagListOutput = z.infer<typeof tagListOutput>;
export type TagCreateOutput = z.infer<typeof tagCreateOutput>;
export type TagPruneOrphansInput = z.infer<typeof tagPruneOrphansInput>;
export type TagPruneOrphansOutput = z.infer<typeof tagPruneOrphansOutput>;
export type TagUpdateInput = z.infer<typeof tagUpdateInput>;
export type TagUpdateOutput = z.infer<typeof tagUpdateOutput>;
