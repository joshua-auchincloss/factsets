import { object, or } from "@optique/core/constructs";
import { envVar, message } from "@optique/core/message";
import { withDefault, optional } from "@optique/core/modifiers";
import {
	command,
	constant,
	option,
	argument,
	flag,
} from "@optique/core/primitives";
import { string } from "@optique/core/valueparser";
import { run } from "@optique/run";
import { drizzle } from "drizzle-orm/better-sqlite3";

const databaseUrl = withDefault(
	option("-u", "--database-url", string(), {
		errors: {
			invalidValue: (error) =>
				message`Invalid database URL: ${error}. Set ${envVar("DATABASE_URL")} or use ${"-u"}.`,
		},
	}),
	process.env.DATABASE_URL ?? ".facts.db",
);

const clientOption = optional(
	option("-c", "--client", string(), {
		errors: {
			invalidValue: () =>
				message`Invalid client. Valid: github-copilot, cursor, claude, generic`,
		},
	}),
);

const skillsDirOption = optional(
	option("-s", "--skills-dir", string(), {
		errors: {
			invalidValue: () => message`Invalid skills directory path`,
		},
	}),
);

const dryRunFlag = optional(
	flag("-d", "--dry", {
		description: message`Dry run mode - initialize server without connecting (for CI smoke tests)`,
	}),
);

const watchSkillsFlag = withDefault(
	flag("-w", "--watch-skills", {
		description: message`Watch skill files for changes and auto-sync (default: true, use --no-watch-skills to disable)`,
	}),
	true,
);

const noWatchSkillsFlag = optional(
	flag("--no-watch-skills", {
		description: message`Disable automatic skill file watching`,
	}),
);

const noSeedFlag = optional(
	flag("--no-seed", {
		description: message`Disable automatic seeding of starter content on first run`,
	}),
);

const pollIntervalOption = withDefault(
	option("-p", "--poll-interval", string(), {
		errors: {
			invalidValue: () => message`Invalid poll interval (milliseconds)`,
		},
	}),
	"5000",
);

const outputFileArg = argument(string(), {
	description: message`Output file path for the dump`,
});

const inputFileArg = argument(string(), {
	description: message`Input file path for restore`,
});

const hostOption = optional(
	option("-H", "--host", string(), {
		description: message`Host to bind HTTP server to (enables HTTP mode instead of stdio)`,
		errors: {
			invalidValue: () => message`Invalid host`,
		},
	}),
);

const portOption = optional(
	option("-P", "--port", string(), {
		description: message`Port to bind HTTP server to (requires --host)`,
		errors: {
			invalidValue: () => message`Invalid port`,
		},
	}),
);

export const connect = (databaseUrl: string) => {
	return drizzle(databaseUrl);
};

// Options parser for mcp-server (reusable with and without command name)
const mcpServerOptions = object({
	type: constant("mcp-server"),
	databaseUrl,
	client: clientOption,
	skillsDir: skillsDirOption,
	dryRun: dryRunFlag,
	watchSkills: watchSkillsFlag,
	noWatchSkills: noWatchSkillsFlag,
	noSeed: noSeedFlag,
	host: hostOption,
	port: portOption,
});

const mcpServerCommand = command("mcp-server", mcpServerOptions);

const watchFilesCommand = command(
	"watch-files",
	object({
		type: constant("watch-files"),
		databaseUrl,
		pollInterval: pollIntervalOption,
	}),
);

const formatOption = withDefault(
	option("-f", "--format", string(), {
		description: message`Output format: markdown or json`,
		errors: {
			invalidValue: () => message`Invalid format. Valid: markdown, json`,
		},
	}),
	"markdown",
);

const capabilitiesCommand = command(
	"capabilities",
	object({
		type: constant("capabilities"),
		format: formatOption,
	}),
);

const dumpCommand = command(
	"dump",
	object({
		type: constant("dump"),
		databaseUrl,
		outputFile: outputFileArg,
	}),
);

const restoreCommand = command(
	"restore",
	object({
		type: constant("restore"),
		databaseUrl,
		inputFile: inputFileArg,
	}),
);

const workerCommand = command(
	"worker",
	object({
		type: constant("worker"),
		databaseUrl,
	}),
);

export type McpServerConfig = {
	readonly type: "mcp-server";
	readonly databaseUrl: string;
	readonly client?: string;
	readonly skillsDir?: string;
	readonly dryRun?: true;
	readonly watchSkills: boolean;
	readonly noWatchSkills?: true;
	readonly noSeed?: true;
	readonly host?: string;
	readonly port?: string;
};

export type WatchFilesConfig = {
	readonly type: "watch-files";
	readonly databaseUrl: string;
	readonly pollInterval: string;
};

export type DumpConfig = {
	readonly type: "dump";
	readonly databaseUrl: string;
	readonly outputFile: string;
};

export type RestoreConfig = {
	readonly type: "restore";
	readonly databaseUrl: string;
	readonly inputFile: string;
};

export type WorkerConfig = {
	readonly type: "worker";
	readonly databaseUrl: string;
};

export type CapabilitiesConfig = {
	readonly type: "capabilities";
	readonly format: string;
};

type Command =
	| McpServerConfig
	| WatchFilesConfig
	| DumpConfig
	| RestoreConfig
	| WorkerConfig
	| CapabilitiesConfig;

export type AppConfig = {
	readonly command: Command;
};

const appConfig = object({
	command: or(
		mcpServerCommand,
		watchFilesCommand,
		capabilitiesCommand,
		dumpCommand,
		restoreCommand,
		workerCommand,
		// Default: mcp-server without explicit command name
		mcpServerOptions,
	),
});

export const config: AppConfig = run(appConfig, {
	programName: "factsets",
	help: "both",
	aboveError: "usage",
});
