import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index.js";
import {
	getConfig,
	setConfig,
	deleteConfig,
	getAllConfig,
	getConfigSchema,
	validateConfigValue,
} from "../db/operations/config.js";
import { resolveSkillsDir } from "../db/operations/skills.js";
import { skills } from "../db/schema.js";
import { z } from "zod";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, basename } from "node:path";
import { eq } from "drizzle-orm";
import { fileExists, readTextFile, writeTextFile } from "../utils/fs.js";

const getConfigInput = z.object({
	key: z.string().min(1),
});

const setConfigInput = z.object({
	key: z.string().min(1),
	value: z.string().min(1),
	migrate: z
		.boolean()
		.optional()
		.describe(
			"For skills_dir: migrate existing skills to the new directory and update DB paths",
		),
});

const deleteConfigInput = z.object({
	key: z.string().min(1),
});

async function migrateSkillsDir(
	db: DB,
	oldDir: string,
	newDir: string,
): Promise<{ moved: number; errors: string[] }> {
	const errors: string[] = [];
	let moved = 0;

	// Create new directory
	await mkdir(newDir, { recursive: true });

	// Get all skills from DB
	const allSkills = await db.select().from(skills);

	for (const skill of allSkills) {
		const oldPath = skill.filePath;
		const fileName = basename(oldPath);
		const newPath = join(newDir, fileName);

		try {
			// Check if old file exists and move it
			if (await fileExists(oldPath)) {
				const content = await readTextFile(oldPath);
				await writeTextFile(newPath, content);
				await rm(oldPath, { force: true });
			}

			// Update DB path regardless (in case file was already in new location or missing)
			await db
				.update(skills)
				.set({ filePath: newPath })
				.where(eq(skills.id, skill.id));

			moved++;
		} catch (err) {
			errors.push(
				`Failed to migrate ${skill.name}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// Try to clean up old directory if empty
	try {
		const remaining = await readdir(oldDir);
		if (remaining.length === 0) {
			await rm(oldDir, { recursive: true, force: true });
		}
	} catch {
		// Ignore cleanup errors
	}

	return { moved, errors };
}

export function registerConfigTools(server: McpServer, db: DB) {
	server.registerTool(
		"get_config",
		{
			title: "Get Configuration",
			description: "Get a configuration value by key",
			inputSchema: getConfigInput,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ key }) => {
			const value = await getConfig(db, key);
			const schema = getConfigSchema();
			const keySchema = schema[key as keyof typeof schema];
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							key,
							value,
							schema: keySchema
								? {
										description: keySchema.description,
										type: keySchema.type,
										default: keySchema.default,
										...("values" in keySchema
											? { values: keySchema.values }
											: {}),
									}
								: null,
						}),
					},
				],
			};
		},
	);

	server.registerTool(
		"set_config",
		{
			title: "Set Configuration",
			description:
				"Set a configuration value. Use get_config_schema to see all available options with descriptions and valid values. Freshness settings control staleness thresholds in hours.",
			inputSchema: setConfigInput,
			annotations: {
				idempotentHint: true,
			},
		},
		async ({ key, value, migrate }) => {
			// Validate the value
			const validation = validateConfigValue(key, value);
			if (!validation.valid) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								success: false,
								error: validation.error,
							}),
						},
					],
					isError: true,
				};
			}

			// Special handling for skills_dir with migration
			if (key === "skills_dir" && migrate) {
				const oldDir = await resolveSkillsDir(db);
				const newDir = value;

				if (oldDir !== newDir) {
					const result = await migrateSkillsDir(db, oldDir, newDir);

					// Set the new config value
					await setConfig(db, key, value);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									success: true,
									key,
									value,
									migration: {
										from: oldDir,
										to: newDir,
										moved: result.moved,
										errors: result.errors,
									},
								}),
							},
						],
					};
				}
			}

			await setConfig(db, key, value);
			return {
				content: [
					{ type: "text", text: JSON.stringify({ success: true, key, value }) },
				],
			};
		},
	);

	server.registerTool(
		"delete_config",
		{
			title: "Delete Configuration",
			description: "Delete a configuration value by key",
			inputSchema: deleteConfigInput,
			annotations: {
				destructiveHint: true,
				idempotentHint: true,
			},
		},
		async ({ key }) => {
			await deleteConfig(db, key);
			return {
				content: [
					{ type: "text", text: JSON.stringify({ success: true, key }) },
				],
			};
		},
	);

	server.registerTool(
		"list_config",
		{
			title: "List Configuration",
			description: "List all configuration values with their current settings",
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const currentConfig = await getAllConfig(db);
			const schema = getConfigSchema();

			// Build a merged view showing current values alongside schema info
			const configWithSchema: Record<
				string,
				{
					value: string | null;
					description: string;
					type: string;
					default: string | number | boolean | null;
					values?: readonly string[];
				}
			> = {};

			for (const [key, schemaEntry] of Object.entries(schema)) {
				configWithSchema[key] = {
					value: currentConfig[key] ?? null,
					description: schemaEntry.description,
					type: schemaEntry.type,
					default: schemaEntry.default,
					...("values" in schemaEntry ? { values: schemaEntry.values } : {}),
				};
			}

			// Include any custom keys not in schema
			for (const [key, value] of Object.entries(currentConfig)) {
				if (!(key in configWithSchema)) {
					configWithSchema[key] = {
						value,
						description: "Custom configuration key",
						type: "string",
						default: null,
					};
				}
			}

			return {
				content: [
					{ type: "text", text: JSON.stringify(configWithSchema, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"get_config_schema",
		{
			title: "Get Configuration Schema",
			description:
				"Get the configuration schema showing all available options with descriptions, types, and defaults. Use this to discover configurable settings like freshness thresholds.",
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const schema = getConfigSchema();
			const formatted: Record<
				string,
				{
					description: string;
					type: string;
					default: string | number | boolean | null;
					values?: readonly string[];
				}
			> = {};

			for (const [key, entry] of Object.entries(schema)) {
				formatted[key] = {
					description: entry.description,
					type: entry.type,
					default: entry.default,
					...("values" in entry ? { values: entry.values } : {}),
				};
			}

			return {
				content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
			};
		},
	);
}
