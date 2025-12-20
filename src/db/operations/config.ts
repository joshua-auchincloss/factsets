import { eq, sql } from "drizzle-orm";
import type { DB } from "../index.js";
import { config } from "../schema.js";

export async function getConfig(db: DB, key: string): Promise<string | null> {
	const result = await db
		.select()
		.from(config)
		.where(eq(config.key, key))
		.limit(1);
	return result[0]?.value ?? null;
}

export async function setConfig(
	db: DB,
	key: string,
	value: string,
): Promise<void> {
	await db
		.insert(config)
		.values({ key, value })
		.onConflictDoUpdate({
			target: config.key,
			set: { value, updatedAt: sql`(CURRENT_TIMESTAMP)` },
		});
}

export async function deleteConfig(db: DB, key: string): Promise<void> {
	await db.delete(config).where(eq(config.key, key));
}

export async function getAllConfig(db: DB): Promise<Record<string, string>> {
	const results = await db.select().from(config);
	return Object.fromEntries(results.map((r) => [r.key, r.value]));
}
