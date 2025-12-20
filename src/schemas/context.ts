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
	summary: z.object({
		totalStale: z.number(),
		resources: z.number(),
		skills: z.number(),
		facts: z.number(),
		pendingReview: z.number(),
	}),
});

export type ContextBuildInput = z.infer<typeof contextBuildInput>;
export type CheckStaleInput = z.infer<typeof checkStaleInput>;
export type CheckStaleOutput = z.infer<typeof checkStaleOutput>;
