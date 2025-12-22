import { z } from "zod";

const retrievalMethod = z
	.object({
		type: z.string(),
		command: z.string().optional(),
		url: z.string().optional(),
		headers: z.record(z.string(), z.string()).optional(),
	})
	.nullable();

export const contextBuildInput = z.object({
	tags: z.array(z.string().min(1)).min(1),
	includeFacts: z.boolean().default(true).optional(),
	includeResources: z.boolean().default(true).optional(),
	includeSkills: z.boolean().default(true).optional(),
	maxFacts: z.number().int().positive().default(50).optional(),
	maxResources: z.number().int().positive().default(20).optional(),
	maxSkills: z.number().int().positive().default(10).optional(),
	format: z.enum(["text", "json"]).default("text").optional(),
	includeStalenessWarnings: z.boolean().default(true).optional(),
});

export const checkStaleInput = z.object({
	checkResources: z.boolean().default(true).optional(),
	checkSkills: z.boolean().default(true).optional(),
	checkFacts: z.boolean().default(true).optional(),
	maxAgeHours: z
		.number()
		.int()
		.positive()
		.default(168)
		.optional()
		.describe(
			"Hours before content is considered stale (default: 168 = 7 days)",
		),
});

export const checkStaleOutput = z.object({
	staleResources: z.array(
		z.object({
			id: z.number(),
			uri: z.string(),
			type: z.string(),
			lastVerifiedAt: z.string().optional(),
			daysStale: z.number(),
			hoursStale: z.number(),
			retrievalMethod: retrievalMethod,
		}),
	),
	approachingStaleResources: z.array(
		z.object({
			id: z.number(),
			uri: z.string(),
			type: z.string(),
			lastVerifiedAt: z.string().optional(),
			hoursUntilStale: z.number(),
			percentToStale: z.number(),
		}),
	),
	staleSkills: z.array(
		z.object({
			id: z.number(),
			name: z.string(),
			reason: z.string(),
			staleDependencies: z.array(
				z.object({
					type: z.enum(["resource", "fact", "skill"]),
					id: z.number(),
					name: z.string(),
				}),
			),
		}),
	),
	unverifiedFacts: z.array(
		z.object({
			id: z.number(),
			content: z.string(),
			daysOld: z.number(),
			sourceType: z.string(),
		}),
	),
	skillsNeedingReview: z.array(
		z.object({
			id: z.number(),
			name: z.string(),
			title: z.string(),
			filePath: z.string(),
		}),
	),
	incompleteDescriptions: z.array(
		z.object({
			type: z.enum(["resource", "skill"]),
			id: z.number(),
			name: z.string(),
			description: z.string(),
		}),
	),
	summary: z.object({
		totalStale: z.number(),
		resources: z.number(),
		skills: z.number(),
		facts: z.number(),
		pendingReview: z.number(),
		incompleteDescriptions: z.number(),
		approachingStaleResources: z.number(),
	}),
});

export const markRefreshedInput = z.object({
	ids: z
		.array(z.number().int().positive())
		.min(1)
		.describe("Resource IDs to mark as refreshed"),
});

export const markRefreshedOutput = z.object({
	affected: z.number().describe("Number of resources marked as refreshed"),
	skillsToReview: z
		.array(
			z.object({
				id: z.number(),
				name: z.string(),
			}),
		)
		.describe("Skills that reference the refreshed resources"),
});

// Schema for resource category inference
export const freshnessCategory = z.enum([
	"lockFiles",
	"configFiles",
	"documentation",
	"generatedFiles",
	"apiSchemas",
	"sourceCode",
	"database",
	"scripts",
	"tests",
	"assets",
	"infrastructure",
	"default",
]);

export const inferCategoryInput = z.object({
	uri: z.string().min(1).describe("URI or file path to infer category for"),
});

export const inferCategoryOutput = z.object({
	uri: z.string(),
	categories: z
		.array(freshnessCategory)
		.describe("All matched categories for this URI"),
	primaryCategory: freshnessCategory.describe(
		"Primary category (first match or 'default')",
	),
	freshnessThresholdHours: z
		.number()
		.describe(
			"Minimum freshness threshold in hours across all matched categories (strictest wins)",
		),
});

export const inferCategoriesBatchInput = z.object({
	uris: z
		.array(z.string().min(1))
		.min(1)
		.describe("URIs or file paths to infer categories for"),
});

export const inferCategoriesBatchOutput = z.object({
	results: z.array(inferCategoryOutput),
});

export type ContextBuildInput = z.infer<typeof contextBuildInput>;
export type CheckStaleInput = z.infer<typeof checkStaleInput>;
export type CheckStaleOutput = z.infer<typeof checkStaleOutput>;
export type MarkRefreshedInput = z.infer<typeof markRefreshedInput>;
export type MarkRefreshedOutput = z.infer<typeof markRefreshedOutput>;
export type FreshnessCategoryType = z.infer<typeof freshnessCategory>;
export type InferCategoryInput = z.infer<typeof inferCategoryInput>;
export type InferCategoryOutput = z.infer<typeof inferCategoryOutput>;
export type InferCategoriesBatchInput = z.infer<
	typeof inferCategoriesBatchInput
>;
export type InferCategoriesBatchOutput = z.infer<
	typeof inferCategoriesBatchOutput
>;
