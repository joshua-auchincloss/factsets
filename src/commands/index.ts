import type { AppConfig } from "../config.js";
import { mcpServerHandler } from "./mcp-server.js";
import { dumpHandler, restoreHandler } from "./dump.js";
import { watchFilesHandler } from "./watch-files.js";
import { workerHandler } from "./worker.js";
import type { CommandRegistry } from "./types.js";

const handlers: CommandRegistry = {
	"mcp-server": mcpServerHandler,
	"watch-files": watchFilesHandler,
	dump: dumpHandler,
	restore: restoreHandler,
	worker: workerHandler,
};

export async function dispatch(config: AppConfig): Promise<void> {
	const { command } = config;
	switch (command.type) {
		case "mcp-server":
			await handlers["mcp-server"](command);
			break;
		case "watch-files":
			await handlers["watch-files"](command);
			break;
		case "dump":
			await handlers["dump"](command);
			break;
		case "restore":
			await handlers["restore"](command);
			break;
		case "worker":
			await handlers["worker"](command);
			break;
	}
}

export type { CommandHandler, CommandConfig, CommandType } from "./types.js";
