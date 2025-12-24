import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	StdioClientTransport,
	StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { createConnection, runMigrations } from "../src/db";

type PromiseResult<T> = T extends Promise<infer U> ? U : T;

export type TestDB = PromiseResult<ReturnType<typeof createTestDb>>;
export type TestServer = PromiseResult<ReturnType<typeof createTestServer>>;

/** Default request timeout (ms) - increased for CI environments */
const DEFAULT_REQUEST_TIMEOUT = 120000;

/** Default connection timeout (ms) - Windows CI needs more time to spawn processes */
const DEFAULT_CONNECTION_TIMEOUT = 60000;

export async function createTestDb() {
	const db = createConnection(":memory:");
	await runMigrations(db);
	return db;
}

export interface TestServerOptions extends Partial<StdioServerParameters> {
	/** Timeout for individual requests in ms (default: 120000) */
	requestTimeout?: number;
	/** Timeout for initial connection in ms (default: 60000) */
	connectionTimeout?: number;
}

export async function createTestServer(overrides?: TestServerOptions) {
	const requestTimeout = overrides?.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
	const connectionTimeout =
		overrides?.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT;

	const client = new Client(
		{
			name: "test-client",
			version: "1.0.0",
		},
		{
			capabilities: {},
		},
	);

	const transport = new StdioClientTransport({
		command: overrides?.command ?? "bun",
		args: overrides?.args ?? [
			"src/main.ts",
			"mcp-server",
			"--database-url",
			"sqlite://:memory:",
			"--no-watch-skills",
		],
	});

	await client.connect(transport, { timeout: connectionTimeout });

	return {
		client,
		callTool: async (name: string, params?: Record<string, any>) => {
			return await client.callTool({ name, arguments: params }, undefined, {
				timeout: requestTimeout,
			});
		},
		getPrompt: async (name: string, params?: Record<string, any>) => {
			return await client.getPrompt(
				{ name, arguments: params },
				{ timeout: requestTimeout },
			);
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
