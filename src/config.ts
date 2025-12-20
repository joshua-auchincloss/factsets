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

export const connect = (databaseUrl: string) => {
	return drizzle(databaseUrl);
};

const mcpServerCommand = command(
	"mcp-server",
	object({
		type: constant("mcp-server"),
		databaseUrl,
		client: clientOption,
		skillsDir: skillsDirOption,
		dryRun: dryRunFlag,
		watchSkills: watchSkillsFlag,
		noWatchSkills: noWatchSkillsFlag,
		noSeed: noSeedFlag,
	}),
);

const watchFilesCommand = command(
	"watch-files",
	object({
		type: constant("watch-files"),
		databaseUrl,
		pollInterval: pollIntervalOption,
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

export type McpServerConfig = {
	readonly type: "mcp-server";
	readonly databaseUrl: string;
	readonly client?: string;
	readonly skillsDir?: string;
	readonly dryRun?: true;
	readonly watchSkills: boolean;
	readonly noWatchSkills?: true;
	readonly noSeed?: true;
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

type Command = McpServerConfig | WatchFilesConfig | DumpConfig | RestoreConfig;

export type AppConfig = {
	readonly command: Command;
};

const appConfig = object({
	command: or(mcpServerCommand, watchFilesCommand, dumpCommand, restoreCommand),
});

export const config: AppConfig = run(appConfig, {
	programName: "factsets",
	help: "both",
	aboveError: "usage",
});
