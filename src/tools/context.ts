import type { DB } from "../db/index.js";
import {
	checkStale,
	markResourcesRefreshed,
} from "../db/operations/staleness.js";
import {
	checkStaleInput,
	checkStaleOutput,
	markRefreshedInput,
	markRefreshedOutput,
} from "../schemas/context.js";
import { registerDbTool } from "./utils.js";
import type { McpServerCompat } from "../types.js";

export function registerContextTools(server: McpServerCompat, db: DB) {
	registerDbTool(server, db, {
		name: "check_stale",
		title: "Check for Stale Resources",
		description:
			"Check for stale resources, skills with changed dependencies, and unverified facts. Returns retrieval methods for stale resources so you can refresh them.",
		inputSchema: checkStaleInput,
		outputSchema: checkStaleOutput,
		annotations: {
			readOnlyHint: true,
		},
		handler: checkStale,
	});

	registerDbTool(server, db, {
		name: "mark_resources_refreshed",
		title: "Mark Resources as Refreshed",
		description:
			"Mark resources as refreshed after you have verified their content is still valid",
		inputSchema: markRefreshedInput,
		outputSchema: markRefreshedOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, { ids }) => markResourcesRefreshed(db, ids),
	});
}
