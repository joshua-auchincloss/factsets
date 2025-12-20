import type { AppConfig } from "../config.js";

export type CommandType = AppConfig["command"]["type"];

export type CommandConfig<T extends CommandType> = Extract<
	AppConfig["command"],
	{ type: T }
>;

export type CommandHandler<T extends CommandType, Out = void> = (
	config: CommandConfig<T>,
) => Promise<Out>;

export type CommandRegistry = {
	[K in CommandType]: CommandHandler<K, unknown>;
};
