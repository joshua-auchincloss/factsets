import type { ClientType } from "./clients.js";
import { getSkillsDir, isValidClient, DEFAULT_CLIENT } from "./clients.js";

/**
 * Runtime configuration that can be set via CLI options.
 * These take precedence over database-stored config values.
 */
export interface RuntimeConfig {
	/** Client type - determines default skills directory */
	client?: ClientType;
	/** Override skills directory path */
	skillsDir?: string;
}

let runtimeConfig: RuntimeConfig = {};

export function setRuntimeConfig(config: RuntimeConfig): void {
	runtimeConfig = { ...config };
}

export function getRuntimeConfig(): RuntimeConfig {
	return runtimeConfig;
}

/**
 * Get effective client type, with precedence:
 * 1. Runtime config (CLI option)
 * 2. Database config (if provided)
 * 3. Default client
 */
export function getEffectiveClient(dbClient?: string | null): ClientType {
	if (runtimeConfig.client) {
		return runtimeConfig.client;
	}
	if (dbClient && isValidClient(dbClient)) {
		return dbClient;
	}
	return DEFAULT_CLIENT;
}

/**
 * Get effective skills directory, with precedence:
 * 1. Runtime config skillsDir (CLI option)
 * 2. Database config skills_dir
 * 3. Derived from effective client
 */
export function getEffectiveSkillsDir(
	dbSkillsDir?: string | null,
	dbClient?: string | null,
): string {
	if (runtimeConfig.skillsDir) {
		return runtimeConfig.skillsDir;
	}
	if (dbSkillsDir) {
		return dbSkillsDir;
	}
	return getSkillsDir(getEffectiveClient(dbClient));
}
