import type { DB } from "../db/index.js";
import { z } from "zod";
import {
	generateMaintenanceReport,
	generateRefreshGuide,
} from "./generators.js";
import type { McpServerCompat } from "../types.js";

const maintenanceReportArgs = {
	maxAgeHours: z
		.string()
		.optional()
		.describe(
			"Hours before content is considered stale (default: 168 = 7 days)",
		),
};

const refreshGuideArgs = {
	resourceId: z.string().describe("The ID of the resource to refresh"),
};

export function registerMaintenancePrompts(server: McpServerCompat, db: DB) {
	server.registerPrompt(
		"maintenance_report",
		{
			description:
				"Generate a maintenance report showing stale resources, skills with changed dependencies, and unverified facts that need attention",
			argsSchema: maintenanceReportArgs,
		},
		async ({ maxAgeHours }) => {
			const result = await generateMaintenanceReport(db, {
				maxAgeHours: maxAgeHours ? parseInt(maxAgeHours, 10) : undefined,
			});

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: result.markdown,
						},
					},
				],
			};
		},
	);

	server.registerPrompt(
		"refresh_guide",
		{
			description:
				"Get a guide for refreshing a specific stale resource with step-by-step instructions",
			argsSchema: refreshGuideArgs,
		},
		async ({ resourceId }) => {
			const result = await generateRefreshGuide(db, {
				resourceId: parseInt(resourceId, 10),
			});

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: result.markdown,
						},
					},
				],
			};
		},
	);
}
