import type { DB } from "../db/index.js";
import {
	submitFacts,
	searchFacts,
	verifyFacts,
	deleteFacts,
	updateFact,
	verifyFactsByTags,
	restoreFacts,
} from "../db/operations/facts.js";
import {
	factSubmitInput,
	factSearchInput,
	factVerifyInput,
	factDeleteInput,
	factUpdateInput,
	factVerifyByTagsInput,
	factRestoreInput,
	factSubmitOutput,
	factSearchOutput,
	factVerifyOutput,
	factDeleteOutput,
	factUpdateOutput,
	factVerifyByTagsOutput,
	factRestoreOutput,
} from "../schemas/facts.js";
import { registerDbTool } from "./utils.js";
import type { McpServerCompat } from "../types.js";

export function registerFactTools(server: McpServerCompat, db: DB) {
	registerDbTool(server, db, {
		name: "submit_facts",
		title: "Submit Facts",
		description:
			"Submit one or more facts to the knowledge base. Facts with matching content will be updated. Call this immediately when learning something new - do not wait for user prompting.",
		inputSchema: factSubmitInput,
		outputSchema: factSubmitOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: submitFacts,
	});

	registerDbTool(server, db, {
		name: "search_facts",
		title: "Search Facts",
		description:
			"Search for facts by tags, content query, verification status, or source type. Use this on every prompt to validate context before responding - not just at session start.",
		inputSchema: factSearchInput,
		outputSchema: factSearchOutput,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true,
		},
		handler: searchFacts,
	});

	registerDbTool(server, db, {
		name: "verify_facts",
		title: "Verify Facts",
		description: "Mark one or more facts as verified/confirmed",
		inputSchema: factVerifyInput,
		outputSchema: factVerifyOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, params) => {
			await verifyFacts(db, params);
			return { success: true as const, verifiedIds: params.ids };
		},
	});

	registerDbTool(server, db, {
		name: "delete_facts",
		title: "Delete Facts",
		description: "Delete facts by ID, tags, age, or verification status",
		inputSchema: factDeleteInput,
		outputSchema: factDeleteOutput,
		annotations: {
			destructiveHint: true,
		},
		handler: async (db, params) => {
			const deleted = await deleteFacts(db, params);
			return { success: true as const, deleted };
		},
	});

	registerDbTool(server, db, {
		name: "update_fact",
		title: "Update Fact",
		description:
			"Update an existing fact's content, metadata, source, verification status, or tags. " +
			"Find the fact by ID or exact content match. Supports replacing all tags, " +
			"appending new tags, or removing specific tags.",
		inputSchema: factUpdateInput,
		outputSchema: factUpdateOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: updateFact,
	});

	registerDbTool(server, db, {
		name: "verify_facts_by_tags",
		title: "Verify Facts by Tags",
		description:
			"Bulk verify all facts that have specified tags. By default, verifies facts with ANY of the tags. " +
			"Set requireAll=true to only verify facts that have ALL specified tags. " +
			"Returns the count and IDs of verified facts.",
		inputSchema: factVerifyByTagsInput,
		outputSchema: factVerifyByTagsOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: verifyFactsByTags,
	});

	registerDbTool(server, db, {
		name: "restore_facts",
		title: "Restore Facts",
		description:
			"Restore soft-deleted facts by their IDs. Returns the count of facts that were restored.",
		inputSchema: factRestoreInput,
		outputSchema: factRestoreOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, { ids }) => restoreFacts(db, ids),
	});
}
