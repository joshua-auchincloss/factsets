import { z } from "zod";

export const knowledgeContextInput = z.object({
	tags: z
		.array(z.string().min(1))
		.min(1)
		.describe("Tags to build context from"),
	maxFacts: z
		.number()
		.int()
		.positive()
		.default(50)
		.optional()
		.describe("Maximum number of facts to include (default: 50)"),
	maxResources: z
		.number()
		.int()
		.positive()
		.default(20)
		.optional()
		.describe("Maximum number of resources to include (default: 20)"),
	maxSkills: z
		.number()
		.int()
		.positive()
		.default(10)
		.optional()
		.describe("Maximum number of skills to include (default: 10)"),
	includeStalenessWarnings: z
		.boolean()
		.default(true)
		.optional()
		.describe("Include staleness warnings section (default: true)"),
});

export const recallSkillInput = z.object({
	name: z.string().min(1).describe("The name of the skill to recall"),
	includeRefs: z
		.boolean()
		.default(false)
		.optional()
		.describe("Include content of referenced skills (default: false)"),
});

export const maintenanceReportInput = z.object({
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

export const refreshGuideInput = z.object({
	resourceId: z
		.number()
		.int()
		.positive()
		.describe("The ID of the resource to get refresh instructions for"),
});

export type KnowledgeContextInput = z.infer<typeof knowledgeContextInput>;
export type RecallSkillInput = z.infer<typeof recallSkillInput>;
export type MaintenanceReportInput = z.infer<typeof maintenanceReportInput>;
export type RefreshGuideInput = z.infer<typeof refreshGuideInput>;
