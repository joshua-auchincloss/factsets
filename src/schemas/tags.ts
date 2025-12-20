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
				description: z.string().optional(),
			}),
		)
		.min(1),
});

export const tagOutput = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
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

export type TagListInput = z.infer<typeof tagListInput>;
export type TagCreateInput = z.infer<typeof tagCreateInput>;
export type TagListOutput = z.infer<typeof tagListOutput>;
export type TagCreateOutput = z.infer<typeof tagCreateOutput>;
