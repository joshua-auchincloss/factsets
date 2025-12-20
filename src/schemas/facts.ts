import { z } from "zod";

const sourceType = z.enum(["user", "documentation", "code", "inference"]);

export const factSubmitInput = z.object({
	facts: z
		.array(
			z.object({
				content: z.string().min(1),
				tags: z.array(z.string().min(1)),
				source: z.string().optional(),
				sourceType: sourceType.optional(),
				verified: z.boolean().default(false).optional(),
			}),
		)
		.min(1),
});

export const factSearchInput = z.object({
	tags: z.array(z.string()).optional(),
	query: z.string().optional(),
	limit: z.number().int().positive().default(50).optional(),
	cursor: z.string().optional().describe("Opaque cursor for pagination"),
	verifiedOnly: z.boolean().optional(),
	sourceType: sourceType.optional(),
	orderBy: z.enum(["recent", "oldest", "usage"]).default("recent").optional(),
});

export const factVerifyInput = z.object({
	ids: z.array(z.number().int().positive()).min(1),
});

export const factDeleteInput = z.object({
	ids: z.array(z.number().int().positive()).optional(),
	tags: z.array(z.string()).optional(),
	olderThan: z.string().datetime().optional(),
	unverifiedOnly: z.boolean().optional(),
});

export const factUpdateInput = z
	.object({
		id: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("The ID of the fact to update"),
		contentMatch: z
			.string()
			.optional()
			.describe("Match fact by exact content instead of ID"),
		updates: z
			.object({
				content: z
					.string()
					.min(1)
					.optional()
					.describe("New content for the fact"),
				source: z.string().optional().describe("New source attribution"),
				sourceType: sourceType.optional().describe("New source type"),
				verified: z.boolean().optional().describe("Set verification status"),
				tags: z
					.array(z.string().min(1))
					.optional()
					.describe("Replace tags with this list"),
				appendTags: z
					.array(z.string().min(1))
					.optional()
					.describe("Add these tags without removing existing"),
				removeTags: z
					.array(z.string().min(1))
					.optional()
					.describe("Remove these specific tags"),
			})
			.describe("The fields to update"),
	})
	.refine((data) => data.id !== undefined || data.contentMatch !== undefined, {
		message: "Either 'id' or 'contentMatch' must be provided",
	});

export const factVerifyByTagsInput = z.object({
	tags: z
		.array(z.string().min(1))
		.min(1)
		.describe("Tags to match - facts with ANY of these tags will be verified"),
	requireAll: z
		.boolean()
		.optional()
		.default(false)
		.describe("If true, only verify facts that have ALL specified tags"),
});

export const factSubmitOutput = z.object({
	created: z.number(),
	updated: z.number(),
	facts: z.array(
		z.object({
			id: z.number(),
			content: z.string(),
		}),
	),
});

export const factSearchOutput = z.object({
	facts: z.array(
		z.object({
			id: z.number(),
			content: z.string(),
			tags: z.array(z.string()),
			verified: z.boolean(),
			sourceType: z.string().nullable(),
			updatedAt: z.string(),
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

export type FactSubmitInput = z.infer<typeof factSubmitInput>;
export type FactSearchInput = z.infer<typeof factSearchInput>;
export type FactVerifyInput = z.infer<typeof factVerifyInput>;
export type FactDeleteInput = z.infer<typeof factDeleteInput>;
export type FactUpdateInput = z.infer<typeof factUpdateInput>;
export type FactVerifyByTagsInput = z.infer<typeof factVerifyByTagsInput>;
export type FactSubmitOutput = z.infer<typeof factSubmitOutput>;
export type FactSearchOutput = z.infer<typeof factSearchOutput>;
