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
} from "../schemas/skills.js";

export function registerSkillTools(server: McpServer, db: DB) {
	server.registerTool(
		"create_skill",
		{
			description:
				"Create a new skill document. Skills are markdown files that capture procedural knowledge and can reference other skills, resources, and facts.",
			inputSchema: skillCreateInput,
		},
		async (params) => {
			const result = await createSkill(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"update_skill",
		{
			description:
				"Update an existing skill's metadata, tags, or references. Does not modify skill file content - use sync_skill after editing the file directly.",
			inputSchema: skillUpdateInput,
		},
		async (params) => {
			await updateSkill(db, params);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ success: true, name: params.name }),
					},
				],
			};
		},
	);

	server.registerTool(
		"sync_skill",
		{
			description:
				"Sync a skill's content hash after the file has been modified externally. Reads the skill file and updates the stored hash if changed.",
			inputSchema: skillSyncInput,
		},
		async (params) => {
			const result = await syncSkill(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"search_skills",
		{
			description: "Search for skills by tags or title query",
			inputSchema: skillSearchInput,
		},
		async (params) => {
			const result = await searchSkills(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"get_skill",
		{
			description:
				"Retrieve a skill by name with its full content, tags, and references. Set hydrateRefs to include content of referenced skills.",
			inputSchema: skillGetInput,
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
			};
		},
	);

	server.registerTool(
		"get_skills",
		{
			description:
				"Retrieve multiple skills by name in a single call. Returns found skills and lists any not found.",
			inputSchema: skillsGetInput,
		},
		async (params) => {
			const result = await getSkills(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"link_skill",
		{
			description:
				"Add references from a skill to other skills, resources, or facts",
			inputSchema: skillLinkInput,
		},
		async (params) => {
			await linkSkill(db, params);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							skillName: params.skillName,
						}),
					},
				],
			};
		},
	);

	server.registerTool(
		"delete_skills",
		{
			description:
				"Delete skills by name. Optionally delete the skill files from disk.",
			inputSchema: skillDeleteInput,
		},
		async (params) => {
			const result = await deleteSkills(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"get_dependency_graph",
		{
			description:
				"Get a dependency graph for a skill showing all connected skills, resources, and facts. Returns a tree structure with nodes and edges for visualization. Use this to fully saturate skill context before performing complex tasks.",
			inputSchema: skillDependencyGraphInput,
		},
		async (params) => {
			const result = await getDependencyGraph(db, params);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"restore_skills",
		{
			description:
				"Restore soft-deleted skills by their names. Returns the count of skills that were restored.",
			inputSchema: skillRestoreInput,
		},
		async ({ names }) => {
			const result = await restoreSkills(db, names);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		},
	);
}
