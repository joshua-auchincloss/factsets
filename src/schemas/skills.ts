import { z } from "zod";

const relationType = z.enum(["prerequisite", "related", "extends"]);

const skillReferences = z.object({
	skills: z.array(z.string()).optional(),
	resources: z.array(z.number().int().positive()).optional(),
	facts: z.array(z.number().int().positive()).optional(),
});

const skillReferencesUpdate = z.object({
	skills: z
		.object({
			add: z.array(z.string()).optional(),
			remove: z.array(z.string()).optional(),
		})
		.optional(),
	resources: z
		.object({
			add: z.array(z.number().int().positive()).optional(),
			remove: z.array(z.number().int().positive()).optional(),
		})
		.optional(),
	facts: z
		.object({
			add: z.array(z.number().int().positive()).optional(),
			remove: z.array(z.number().int().positive()).optional(),
		})
		.optional(),
});

export const skillCreateInput = z.object({
	name: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "Name must be lowercase alphanumeric with dashes"),
	title: z.string().min(1),
	description: z.string().optional(),
	content: z.string().min(1),
	tags: z.array(z.string().min(1)),
	references: skillReferences.optional(),
});

export const skillUpdateInput = z.object({
	name: z.string().min(1),
	title: z.string().optional(),
	description: z.string().optional(),
	tags: z.array(z.string()).optional(),
	appendTags: z.array(z.string()).optional(),
	references: skillReferencesUpdate.optional(),
});

export const skillSyncInput = z.object({
	name: z.string().min(1),
});

export const skillSearchInput = z.object({
	tags: z.array(z.string()).optional(),
	query: z.string().optional(),
	limit: z.number().int().positive().default(30).optional(),
	cursor: z.string().optional().describe("Opaque cursor for pagination"),
	orderBy: z.enum(["recent", "oldest", "name"]).default("recent").optional(),
});

export const skillGetInput = z.object({
	name: z.string().min(1),
	hydrateRefs: z.boolean().default(false).optional(),
});

export const skillsGetInput = z.object({
	names: z.array(z.string().min(1)).min(1),
	hydrateRefs: z.boolean().default(false).optional(),
});

export const skillLinkInput = z.object({
	skillName: z.string().min(1),
	linkSkills: z
		.array(
			z.object({
				name: z.string().min(1),
				relation: relationType,
			}),
		)
		.optional(),
	linkResources: z.array(z.number().int().positive()).optional(),
	linkFacts: z.array(z.number().int().positive()).optional(),
});

export const skillDeleteInput = z.object({
	names: z.array(z.string().min(1)).min(1),
	deleteFiles: z.boolean().default(false).optional(),
});

export const skillCreateOutput = z.object({
	id: z.number(),
	name: z.string(),
	filePath: z.string(),
});

export const skillSearchOutput = z.object({
	skills: z.array(
		z.object({
			id: z.number(),
			name: z.string(),
			title: z.string(),
			description: z.string().nullable(),
			tags: z.array(z.string()),
			filePath: z.string(),
			hasStaleDeps: z.boolean(),
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

export const skillGetOutput = z.object({
	name: z.string(),
	title: z.string(),
	content: z.string(),
	tags: z.array(z.string()),
	references: z.object({
		skills: z.array(
			z.object({
				name: z.string(),
				title: z.string(),
				relation: z.string(),
			}),
		),
		resources: z.array(
			z.object({
				id: z.number(),
				uri: z.string(),
				isStale: z.boolean(),
			}),
		),
		facts: z.array(
			z.object({
				id: z.number(),
				content: z.string(),
			}),
		),
	}),
	hydratedSkills: z
		.array(
			z.object({
				name: z.string(),
				content: z.string(),
			}),
		)
		.optional(),
});

export const skillsGetOutput = z.object({
	skills: z.array(skillGetOutput),
	notFound: z.array(z.string()),
});

export type SkillCreateInput = z.infer<typeof skillCreateInput>;
export type SkillUpdateInput = z.infer<typeof skillUpdateInput>;
export type SkillSyncInput = z.infer<typeof skillSyncInput>;
export type SkillSearchInput = z.infer<typeof skillSearchInput>;
export type SkillGetInput = z.infer<typeof skillGetInput>;
export type SkillsGetInput = z.infer<typeof skillsGetInput>;
export type SkillLinkInput = z.infer<typeof skillLinkInput>;
export type SkillDeleteInput = z.infer<typeof skillDeleteInput>;
export type SkillCreateOutput = z.infer<typeof skillCreateOutput>;
export type SkillSearchOutput = z.infer<typeof skillSearchOutput>;
export type SkillGetOutput = z.infer<typeof skillGetOutput>;
export type SkillsGetOutput = z.infer<typeof skillsGetOutput>;
