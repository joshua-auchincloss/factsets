import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	addResources,
	searchResources,
	getResource,
	getResources,
	updateResourceSnapshot,
	updateResourceSnapshots,
	updateResource,
	deleteResources,
	restoreResources,
} from "../db/operations/resources.js";
import {
	resourceAddInput,
	resourceSearchInput,
	resourceGetInput,
	resourcesGetInput,
	resourceUpdateSnapshotInput,
	resourceUpdateSnapshotsInput,
	resourceUpdateInput,
	resourceDeleteInput,
	resourceRestoreInput,
	resourceAddOutput,
	resourceSearchOutput,
	resourceGetOutput,
	resourcesGetOutput,
	resourceUpdateSnapshotOutput,
	resourceUpdateSnapshotsOutput,
	resourceUpdateOutput,
	resourceDeleteOutput,
	resourceRestoreOutput,
} from "../schemas/resources.js";
import { registerDbTool } from "./utils.js";
import { z } from "zod";

// Error output schema for resource not found
const resourceNotFoundOutput = z.object({
	error: z.string(),
});

export function registerResourceTools(server: McpServer, db: DB) {
	registerDbTool(server, db, {
		name: "add_resources",
		title: "Add Resources",
		description:
			"Register one or more resources (files, URLs, APIs, commands) with metadata for tracking. " +
			"The system stores retrieval methods - actual fetching is performed by you. " +
			"Register immediately after fetching - don't wait for user prompting.",
		inputSchema: resourceAddInput,
		outputSchema: resourceAddOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: addResources,
	});

	registerDbTool(server, db, {
		name: "search_resources",
		title: "Search Resources",
		description:
			"Search for resources by tags, type, or URI pattern. " +
			"Check for existing resources before registering new ones to avoid duplicates.",
		inputSchema: resourceSearchInput,
		outputSchema: resourceSearchOutput,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true,
		},
		handler: searchResources,
	});

	// get_resource has special error handling - keep server.registerTool
	server.registerTool(
		"get_resource",
		{
			title: "Get Resource",
			description:
				"Get a specific resource by ID or URI. Returns the stored snapshot and retrieval method for you to refresh if needed.",
			inputSchema: resourceGetInput,
			outputSchema: resourceGetOutput,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (params) => {
			const result = await getResource(db, params);
			if (!result) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: "Resource not found" }),
						},
					],
					isError: true,
				};
			}
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				structuredContent: result,
			};
		},
	);

	registerDbTool(server, db, {
		name: "get_resources",
		title: "Get Resources",
		description:
			"Retrieve multiple resources by IDs or URIs in a single call. Returns found resources and lists any not found.",
		inputSchema: resourcesGetInput,
		outputSchema: resourcesGetOutput,
		annotations: {
			readOnlyHint: true,
		},
		handler: getResources,
	});

	registerDbTool(server, db, {
		name: "update_resource_snapshot",
		title: "Update Resource Snapshot",
		description:
			"Update the snapshot content for a resource after you have fetched fresh data using the retrieval method",
		inputSchema: resourceUpdateSnapshotInput,
		outputSchema: resourceUpdateSnapshotOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, params) => {
			await updateResourceSnapshot(db, params);
			return { success: true as const };
		},
	});

	registerDbTool(server, db, {
		name: "update_resource_snapshots",
		title: "Update Resource Snapshots",
		description:
			"Bulk update snapshot content for multiple resources. Each entry requires resourceId and snapshot content.",
		inputSchema: resourceUpdateSnapshotsInput,
		outputSchema: resourceUpdateSnapshotsOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, { snapshots }) =>
			updateResourceSnapshots(db, snapshots),
	});

	registerDbTool(server, db, {
		name: "update_resource",
		title: "Update Resource",
		description:
			"Update resource metadata (description, tags, retrieval method) without modifying snapshot content or lastVerifiedAt timestamp. Use this to fix placeholder descriptions or reorganize tags.",
		inputSchema: resourceUpdateInput,
		outputSchema: resourceUpdateOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: updateResource,
	});

	registerDbTool(server, db, {
		name: "delete_resources",
		title: "Delete Resources",
		description:
			"Delete resources by ID or URI. Also removes associated tags and skill references.",
		inputSchema: resourceDeleteInput,
		outputSchema: resourceDeleteOutput,
		annotations: {
			destructiveHint: true,
		},
		handler: deleteResources,
	});

	registerDbTool(server, db, {
		name: "restore_resources",
		title: "Restore Resources",
		description:
			"Restore soft-deleted resources by their IDs. Returns the count of resources that were restored.",
		inputSchema: resourceRestoreInput,
		outputSchema: resourceRestoreOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, { ids }) => restoreResources(db, ids),
	});
}
