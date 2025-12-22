import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	StdioClientTransport,
	StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { createConnection, runMigrations } from "../src/db";

type PromiseResult<T> = T extends Promise<infer U> ? U : T;

export type TestDB = PromiseResult<ReturnType<typeof createTestDb>>;
export type TestServer = PromiseResult<ReturnType<typeof createTestServer>>;

export async function createTestDb() {
	const db = createConnection(":memory:");
	await runMigrations(db);
	return db;
}

export async function createTestServer(
	overrides?: Partial<StdioServerParameters>,
) {
	const client = new Client({
		name: "test-client",
		version: "1.0.0",
	});

	await client.connect(
		new StdioClientTransport({
			command: overrides?.command ?? "bun",
			args: overrides?.args ?? [
				"src/main.ts",
				"mcp-server",
				"--database-url",
				"sqlite://:memory:",
				"--no-watch-skills",
			],
		}),
	);

	return {
		client,
		callTool: async (name: string, params?: Record<string, any>) => {
			return await client.callTool({ name, arguments: params });
		},
		getPrompt: async (name: string, params?: Record<string, any>) => {
			return await client.getPrompt({ name, arguments: params });
		},
	};
}

export async function seedTestData(db: TestDB) {
	const { submitFacts } = await import("../src/db/operations/facts");
	const { addResources } = await import("../src/db/operations/resources");
	const { createSkill } = await import("../src/db/operations/skills");
	const { setConfig } = await import("../src/db/operations/config");

	await setConfig(db, "client", "test");
	await setConfig(db, "skills_dir", "/tmp/factsets-test-skills");

	await submitFacts(db, {
		facts: [
			{
				content: "TypeScript uses structural typing",
				tags: ["typescript", "types"],
				verified: true,
			},
			{
				content: "Bun is a fast JavaScript runtime",
				tags: ["bun", "runtime"],
				verified: true,
			},
			{
				content: "Drizzle ORM supports SQLite",
				tags: ["drizzle", "database"],
				verified: false,
			},
		],
	});

	await addResources(db, {
		resources: [
			{
				uri: "file:///project/tsconfig.json",
				type: "file",
				description:
					"TypeScript configuration file for project compiler settings",
				tags: ["typescript", "config"],
				snapshot: '{"compilerOptions": {"strict": true}}',
				retrievalMethod: { type: "file" },
			},
			{
				uri: "https://bun.sh/docs",
				type: "url",
				description: "Official Bun documentation website",
				tags: ["bun", "docs"],
				retrievalMethod: { type: "url", url: "https://bun.sh/docs" },
			},
		],
	});

	await createSkill(db, {
		name: "typescript-setup",
		title: "TypeScript Project Setup",
		description: "Guide for setting up a TypeScript project from scratch",
		content:
			"# TypeScript Setup\n\n1. Install TypeScript\n2. Create tsconfig.json\n3. Configure strict mode",
		tags: ["typescript", "setup"],
	});

	return db;
}
