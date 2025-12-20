import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";
import Database from "libsql";
import { projectMeta } from "../meta.js";

export type DB = ReturnType<typeof createConnection>;

export function createConnection(databaseUrl: string) {
	const path = databaseUrl.replace(/^sqlite:\/\//, "");
	const db = new Database(path);
	return drizzle({ schema, client: db });
}

export async function runMigrations(db: DB) {
	const migrationsFolder = projectMeta.findPath("db/migrations");
	await migrate(db, { migrationsFolder });
}

export { schema };
