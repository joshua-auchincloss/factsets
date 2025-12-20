import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	addResources,
	searchResources,
	getResource,
	getResources,
	updateResourceSnapshot,
	updateResourceSnapshots,
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
	resourceDeleteInput,
	resourceRestoreInput,
} from "../schemas/resources.js";

export function registerResourceTools(server: McpServer, db: DB) {
	server.registerTool(
		"add_resources",
		{
			description:
				"Register one or more resources (files, URLs, APIs, commands) with metadata for tracking. The system stores retrieval methods - actual fetching is performed by you.",
			inputSchema: resourceAddInput,
		},
		async ({ resources }) => {
			const result = await addResources(db, { resources });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"search_resources",
		{
			description: "Search for resources by tags, type, or URI pattern",
			inputSchema: resourceSearchInput,
		},
		async (params) => {
			const result = await searchResources(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"get_resource",
		{
			description:
				"Get a specific resource by ID or URI. Returns the stored snapshot and retrieval method for you to refresh if needed.",
			inputSchema: resourceGetInput,
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
			};
		},
	);

	server.registerTool(
		"get_resources",
		{
			description:
				"Retrieve multiple resources by IDs or URIs in a single call. Returns found resources and lists any not found.",
			inputSchema: resourcesGetInput,
		},
		async (params) => {
			const result = await getResources(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"update_resource_snapshot",
		{
			description:
				"Update the snapshot content for a resource after you have fetched fresh data using the retrieval method",
			inputSchema: resourceUpdateSnapshotInput,
		},
		async (params) => {
			await updateResourceSnapshot(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify({ success: true }) }],
			};
		},
	);

	server.registerTool(
		"update_resource_snapshots",
		{
			description:
				"Bulk update snapshot content for multiple resources. Each entry requires resourceId and snapshot content.",
			inputSchema: resourceUpdateSnapshotsInput,
		},
		async ({ snapshots }) => {
			const result = await updateResourceSnapshots(db, snapshots);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"delete_resources",
		{
			description:
				"Delete resources by ID or URI. Also removes associated tags and skill references.",
			inputSchema: resourceDeleteInput,
		},
		async (params) => {
			const result = await deleteResources(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"restore_resources",
		{
			description:
				"Restore soft-deleted resources by their IDs. Returns the count of resources that were restored.",
			inputSchema: resourceRestoreInput,
		},
		async ({ ids }) => {
			const result = await restoreResources(db, ids);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);
}
