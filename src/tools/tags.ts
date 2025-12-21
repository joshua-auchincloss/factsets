import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	listTags,
	createTags,
	updateTags,
	pruneOrphanTags,
} from "../db/operations/tags.js";
import {
	tagListInput,
	tagCreateInput,
	tagUpdateInput,
	tagPruneOrphansInput,
	tagListOutput,
	tagCreateOutput,
	tagUpdateOutput,
	tagPruneOrphansOutput,
} from "../schemas/tags.js";
import { registerDbTool } from "./utils.js";

export function registerTagTools(server: McpServer, db: DB) {
	registerDbTool(server, db, {
		name: "list_tags",
		title: "List Tags",
		description:
			"List all tags in the knowledge base, optionally filtered by name pattern",
		inputSchema: tagListInput,
		outputSchema: tagListOutput,
		annotations: {
			readOnlyHint: true,
		},
		handler: listTags,
	});

	registerDbTool(server, db, {
		name: "create_tags",
		title: "Create Tags",
		description:
			"Create one or more tags for organizing facts, resources, and skills",
		inputSchema: tagCreateInput,
		outputSchema: tagCreateOutput,
		annotations: {
			readOnlyHint: false,
			idempotentHint: true,
		},
		handler: createTags,
	});

	registerDbTool(server, db, {
		name: "update_tags",
		title: "Update Tags",
		description:
			"Update descriptions for existing tags. Use this to replace auto-generated placeholder descriptions with meaningful content.",
		inputSchema: tagUpdateInput,
		outputSchema: tagUpdateOutput,
		annotations: {
			readOnlyHint: false,
			idempotentHint: true,
		},
		handler: updateTags,
	});

	registerDbTool(server, db, {
		name: "prune_orphan_tags",
		title: "Prune Orphan Tags",
		description:
			"Clean up orphan tags that have zero usage (not linked to any facts, resources, skills, or execution logs). Use dryRun=true to preview which tags would be deleted without actually deleting them.",
		inputSchema: tagPruneOrphansInput,
		outputSchema: tagPruneOrphansOutput,
		annotations: {
			destructiveHint: true,
			idempotentHint: true,
		},
		handler: pruneOrphanTags,
	});
}
