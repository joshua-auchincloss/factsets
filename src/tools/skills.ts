import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	createSkill,
	updateSkill,
	syncSkill,
	searchSkills,
	getSkill,
	getSkills,
	linkSkill,
	deleteSkills,
	getDependencyGraph,
	restoreSkills,
} from "../db/operations/skills.js";
import {
	skillCreateInput,
	skillUpdateInput,
	skillSyncInput,
	skillSearchInput,
	skillGetInput,
	skillsGetInput,
	skillLinkInput,
	skillDeleteInput,
	skillDependencyGraphInput,
	skillRestoreInput,
	skillCreateOutput,
	skillUpdateOutput,
	skillSyncOutput,
	skillSearchOutput,
	skillGetOutput,
	skillsGetOutput,
	skillLinkOutput,
	skillDeleteOutput,
	skillDependencyGraphOutput,
	skillRestoreOutput,
} from "../schemas/skills.js";
import { registerDbTool } from "./utils.js";

export function registerSkillTools(server: McpServer, db: DB) {
	registerDbTool(server, db, {
		name: "create_skill",
		title: "Create Skill",
		description:
			"Create a new skill document. Skills are markdown files that capture procedural knowledge and can reference other skills, resources, and facts.",
		inputSchema: skillCreateInput,
		outputSchema: skillCreateOutput,
		annotations: {
			idempotentHint: false,
		},
		handler: createSkill,
	});

	registerDbTool(server, db, {
		name: "update_skill",
		title: "Update Skill",
		description:
			"Update an existing skill's metadata, tags, or references. Does not modify skill file content - use sync_skill after editing the file directly.",
		inputSchema: skillUpdateInput,
		outputSchema: skillUpdateOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, params) => {
			await updateSkill(db, params);
			return { success: true as const, name: params.name };
		},
	});

	registerDbTool(server, db, {
		name: "sync_skill",
		title: "Sync Skill",
		description:
			"Sync a skill's content hash after the file has been modified externally. Reads the skill file and updates the stored hash if changed.",
		inputSchema: skillSyncInput,
		outputSchema: skillSyncOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: syncSkill,
	});

	registerDbTool(server, db, {
		name: "search_skills",
		title: "Search Skills",
		description:
			"Search for skills by tags or title query. Check for existing skills before creating new ones to avoid duplicates.",
		inputSchema: skillSearchInput,
		outputSchema: skillSearchOutput,
		annotations: {
			readOnlyHint: true,
			openWorldHint: true,
		},
		handler: searchSkills,
	});

	// get_skill has special error handling - keep server.registerTool
	server.registerTool(
		"get_skill",
		{
			title: "Get Skill",
			description:
				"Retrieve a skill by name with its full content, tags, and references. Set hydrateRefs to include content of referenced skills.",
			inputSchema: skillGetInput,
			outputSchema: skillGetOutput,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (params) => {
			const result = await getSkill(db, params);
			if (!result) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: "Skill not found" }),
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
		name: "get_skills",
		title: "Get Skills",
		description:
			"Retrieve multiple skills by name in a single call. Returns found skills and lists any not found.",
		inputSchema: skillsGetInput,
		outputSchema: skillsGetOutput,
		annotations: {
			readOnlyHint: true,
		},
		handler: getSkills,
	});

	registerDbTool(server, db, {
		name: "link_skill",
		title: "Link Skill",
		description:
			"Add references from a skill to other skills, resources, or facts",
		inputSchema: skillLinkInput,
		outputSchema: skillLinkOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, params) => {
			await linkSkill(db, params);
			return { success: true as const, skillName: params.skillName };
		},
	});

	registerDbTool(server, db, {
		name: "delete_skills",
		title: "Delete Skills",
		description:
			"Delete skills by name. Optionally delete the skill files from disk.",
		inputSchema: skillDeleteInput,
		outputSchema: skillDeleteOutput,
		annotations: {
			destructiveHint: true,
		},
		handler: deleteSkills,
	});

	registerDbTool(server, db, {
		name: "get_dependency_graph",
		title: "Get Dependency Graph",
		description:
			"Get a dependency graph for a skill showing all connected skills, resources, and facts. Returns a tree structure with nodes and edges for visualization. Use this to fully saturate skill context before performing complex tasks.",
		inputSchema: skillDependencyGraphInput,
		outputSchema: skillDependencyGraphOutput,
		annotations: {
			readOnlyHint: true,
		},
		handler: getDependencyGraph,
	});

	registerDbTool(server, db, {
		name: "restore_skills",
		title: "Restore Skills",
		description:
			"Restore soft-deleted skills by their names. Returns the count of skills that were restored.",
		inputSchema: skillRestoreInput,
		outputSchema: skillRestoreOutput,
		annotations: {
			idempotentHint: true,
		},
		handler: async (db, { names }) => restoreSkills(db, names),
	});
}
