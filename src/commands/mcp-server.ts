import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { CommandHandler } from "./types.js";
import { createConnection, runMigrations } from "../db/index.js";
import { initializeConfigDefaults } from "../db/operations/config.js";
import { registerTagTools } from "../tools/tags.js";
import { registerFactTools } from "../tools/facts.js";
import { registerResourceTools } from "../tools/resources.js";
import { registerSkillTools } from "../tools/skills.js";
import { registerContextTools } from "../tools/context.js";
import { registerConfigTools } from "../tools/config.js";
import { registerPromptTools } from "../tools/prompts.js";
import { registerExecutionLogTools } from "../tools/execution-logs.js";
import { registerPreferencesTools } from "../tools/preferences.js";
import { registerKnowledgePrompts } from "../prompts/knowledge.js";
import { registerMaintenancePrompts } from "../prompts/maintenance.js";
import { setRuntimeConfig } from "../runtime-config.js";
import { isValidClient } from "../clients.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { registerStaticPrompts } from "../prompts/static-prompts.js";
import { projectMeta } from "../meta.js";
import { applySeed } from "../seed/index.js";
import serverJson from "../../server.json" with { type: "json" };
import type { McpServerCompat } from "../types.js";

type Handler = CommandHandler<
	"mcp-server",
	{
		transport: Transport;
		server: McpServer;
		watcherProcess?: ChildProcess;
		httpServer?: Server;
	}
>;

function spawnWatcher(databaseUrl: string): ChildProcess {
	const binPath = process.argv[1] || projectMeta.findPath("../bin/factsets");
	const child = spawn(
		process.execPath,
		[binPath, "watch-files", "-u", databaseUrl],
		{
			stdio: ["ignore", "pipe", "pipe"],
			detached: false,
		},
	);

	// Log watcher output to stderr (so it doesn't interfere with MCP stdio)
	child.stdout?.on("data", (data) => {
		process.stderr.write(data);
	});

	child.stderr?.on("data", (data) => {
		process.stderr.write(data);
	});

	child.on("error", (err) => {
		console.error("[mcp-server] Watcher process error:", err.message);
	});

	child.on("exit", (code) => {
		if (code !== 0 && code !== null) {
			console.error(`[mcp-server] Watcher process exited with code ${code}`);
			throw new Error("Watcher process exited unexpectedly");
		}
	});

	return child;
}

export const register = (
	server: McpServerCompat,
	db: ReturnType<typeof createConnection>,
) => {
	registerTagTools(server, db);
	registerFactTools(server, db);
	registerResourceTools(server, db);
	registerSkillTools(server, db);
	registerContextTools(server, db);
	registerConfigTools(server, db);
	registerPromptTools(server, db);
	registerExecutionLogTools(server, db);
	registerPreferencesTools(server, db);

	registerStaticPrompts(server);
	registerKnowledgePrompts(server, db);
	registerMaintenancePrompts(server, db);
};

export const mcpServerHandler = async (
	config: Parameters<Handler>[0],
	transport?: Transport,
) => {
	// Set runtime config from CLI options
	setRuntimeConfig({
		client:
			config.client && isValidClient(config.client) ? config.client : undefined,
		skillsDir: config.skillsDir,
	});

	const server = new McpServer({
		name: serverJson.name,
		title: serverJson.title,
		description: serverJson.description,
		version: serverJson.version,
		websiteUrl: serverJson.repository.url,
	});

	const db = createConnection(config.databaseUrl);
	await runMigrations(db);

	// Apply seed content on first run (unless --no-seed)
	if (!config.noSeed && !config.dryRun) {
		const seedResult = await applySeed(db);
		if (
			seedResult.tags.created > 0 ||
			seedResult.facts.created > 0 ||
			seedResult.skills.created > 0
		) {
			console.error(
				`[factsets] Seeded knowledge base v${seedResult.version}: ` +
					`${seedResult.tags.created} tags, ${seedResult.facts.created} facts, ${seedResult.skills.created} skills`,
			);
		}
	}

	// Initialize config defaults (ensures all config keys have values)
	if (!config.dryRun) {
		const configInit = await initializeConfigDefaults(db);
		if (configInit.initialized.length > 0) {
			console.error(
				`[factsets] Initialized ${configInit.initialized} config defaults`,
			);
		}
	}

	register(server, db);

	// Determine transport mode: HTTP if host is provided, otherwise stdio
	const useHttpTransport = !!config.host;
	let usedTransport: Transport;
	let httpServer: Server | undefined;

	if (useHttpTransport && !transport) {
		const host = config.host!;
		const port = parseInt(config.port || "3000", 10);

		// Create HTTP transport
		const httpTransport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => crypto.randomUUID(),
		});
		usedTransport = httpTransport;

		// Create HTTP server
		httpServer = createServer(async (req, res) => {
			// Handle CORS preflight
			if (req.method === "OPTIONS") {
				res.writeHead(204, {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
				});
				res.end();
				return;
			}

			// Add CORS headers to all responses
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader(
				"Access-Control-Allow-Headers",
				"Content-Type, mcp-session-id",
			);

			try {
				await httpTransport.handleRequest(req, res);
			} catch (error) {
				console.error("[mcp-server] HTTP request error:", error);
				if (!res.headersSent) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "Internal server error" }));
				}
			}
		});

		httpServer.listen(port, host, () => {
			console.error(
				`[factsets] HTTP MCP server listening on http://${host}:${port}`,
			);
		});
	} else {
		usedTransport = transport ?? new StdioServerTransport();
	}

	// Spawn file watcher subprocess if enabled (default: true)
	// --no-watch-skills overrides --watch-skills
	const shouldWatch =
		config.watchSkills && !config.noWatchSkills && !config.dryRun;

	let watcherProcess: ChildProcess | undefined;

	if (shouldWatch) {
		watcherProcess = spawnWatcher(config.databaseUrl);
	}

	// Clean up watcher on server shutdown
	let isCleaningUp = false;
	const cleanup = (signal?: string) => {
		if (isCleaningUp) return;
		isCleaningUp = true;

		if (watcherProcess) {
			watcherProcess.kill("SIGTERM");
		}

		if (httpServer) {
			httpServer.close();
		}

		// Exit the process after cleanup
		if (signal === "SIGINT" || signal === "SIGTERM") {
			process.exit(0);
		}
	};

	process.on("SIGINT", () => cleanup("SIGINT"));
	process.on("SIGTERM", () => cleanup("SIGTERM"));
	process.on("exit", () => cleanup());

	if (!config.dryRun) {
		await server.connect(usedTransport);
	} else {
		console.log("Dry run complete. Server initialized successfully.");
	}

	return {
		server,
		transport: usedTransport,
		watcherProcess,
		httpServer,
	};
};

namespace _ {
	const _: Handler = mcpServerHandler;
}
