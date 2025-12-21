import type { CommandHandler } from "./types.js";
import { createConnection, runMigrations, type DB } from "../db/index.js";
import { getConfig } from "../db/operations/config.js";
import { deleteFacts } from "../db/operations/facts.js";
import { pruneOrphanTags } from "../db/operations/tags.js";
import { nowISO, daysAgoISO } from "../utils/dates.js";
import { DEFAULT_WORKER_INTERVALS } from "../runtime/defaults.js";
import { facts, resources, skills, workerState } from "../db/schema.js";
import { sql, lt, and, isNotNull, eq } from "drizzle-orm";

type Handler = CommandHandler<"worker">;

/**
 * Task names for worker state tracking
 */
type TaskName = "autoVerify" | "expireFacts" | "pruneTags" | "hardDelete";

/**
 * Worker state persisted to database
 */
interface TaskState {
	taskName: string;
	lastRunAt: string | null;
	lastStatus: "success" | "error" | "skipped" | null;
	lastMessage: string | null;
	itemsProcessed: number;
}

/**
 * Load task state from database
 */
async function loadTaskState(db: DB, taskName: TaskName): Promise<TaskState> {
	const result = await db
		.select()
		.from(workerState)
		.where(eq(workerState.taskName, taskName))
		.limit(1);

	const row = result[0];
	if (!row) {
		return {
			taskName,
			lastRunAt: null,
			lastStatus: null,
			lastMessage: null,
			itemsProcessed: 0,
		};
	}

	return {
		taskName: row.taskName,
		lastRunAt: row.lastRunAt,
		lastStatus: row.lastStatus as TaskState["lastStatus"],
		lastMessage: row.lastMessage,
		itemsProcessed: row.itemsProcessed,
	};
}

/**
 * Save task state to database (upsert)
 */
async function saveTaskState(
	db: DB,
	state: Omit<TaskState, "taskName"> & { taskName: TaskName },
): Promise<void> {
	await db
		.insert(workerState)
		.values({
			taskName: state.taskName,
			lastRunAt: state.lastRunAt,
			lastStatus: state.lastStatus,
			lastMessage: state.lastMessage,
			itemsProcessed: state.itemsProcessed,
			updatedAt: nowISO(),
		})
		.onConflictDoUpdate({
			target: workerState.taskName,
			set: {
				lastRunAt: state.lastRunAt,
				lastStatus: state.lastStatus,
				lastMessage: state.lastMessage,
				itemsProcessed: state.itemsProcessed,
				updatedAt: nowISO(),
			},
		});
}

/**
 * Get interval for a task from config, falling back to defaults
 */
async function getTaskInterval(db: DB, task: TaskName): Promise<number> {
	const configKeyMap: Record<TaskName, string> = {
		autoVerify: "worker_interval_auto_verify",
		expireFacts: "worker_interval_expire_facts",
		pruneTags: "worker_interval_prune_tags",
		hardDelete: "worker_interval_hard_delete",
	};

	const defaultMap: Record<TaskName, number> = {
		autoVerify: DEFAULT_WORKER_INTERVALS.autoVerify,
		expireFacts: DEFAULT_WORKER_INTERVALS.expireFacts,
		pruneTags: DEFAULT_WORKER_INTERVALS.pruneTags,
		hardDelete: DEFAULT_WORKER_INTERVALS.hardDelete,
	};

	const value = await getConfig(db, configKeyMap[task]);
	if (value !== null) {
		const parsed = Number(value);
		if (!Number.isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return defaultMap[task];
}

/**
 * Check if a task should run based on its interval and last run time
 */
function shouldRunTask(state: TaskState, intervalMs: number): boolean {
	if (!state.lastRunAt) return true;

	const lastRun = new Date(state.lastRunAt).getTime();
	const now = Date.now();
	return now - lastRun >= intervalMs;
}

/**
 * Auto-verify old unverified facts that have been retrieved
 * Only verifies facts from user, documentation, code sources (not inference)
 */
async function runAutoVerify(db: DB): Promise<Omit<TaskState, "taskName">> {
	const startTime = nowISO();

	try {
		// Get config for auto-verify (disabled by default - fact_auto_verify_after_days)
		const autoVerifyDays = await getConfig(db, "fact_auto_verify_after_days");
		if (!autoVerifyDays) {
			return {
				lastRunAt: startTime,
				lastStatus: "skipped",
				lastMessage:
					"Auto-verify disabled (fact_auto_verify_after_days not set)",
				itemsProcessed: 0,
			};
		}

		const days = Number(autoVerifyDays);
		if (Number.isNaN(days) || days <= 0) {
			return {
				lastRunAt: startTime,
				lastStatus: "skipped",
				lastMessage: "Invalid fact_auto_verify_after_days value",
				itemsProcessed: 0,
			};
		}

		const cutoffDate = daysAgoISO(days);

		// Auto-verify facts that:
		// - Are unverified
		// - Created before cutoff
		// - Have been retrieved at least once
		// - Are not inference-sourced
		const result = await db
			.update(facts)
			.set({
				verified: true,
				updatedAt: sql`(CURRENT_TIMESTAMP)` as unknown as string,
			})
			.where(
				and(
					eq(facts.verified, false),
					lt(facts.createdAt, cutoffDate),
					sql`${facts.retrievalCount} > 0`,
					sql`${facts.sourceType} != 'inference'`,
					sql`${facts.deletedAt} IS NULL`,
				),
			)
			.returning({ id: facts.id });

		return {
			lastRunAt: startTime,
			lastStatus: "success",
			lastMessage: `Auto-verified ${result.length} facts older than ${days} days`,
			itemsProcessed: result.length,
		};
	} catch (err) {
		return {
			lastRunAt: startTime,
			lastStatus: "error",
			lastMessage: err instanceof Error ? err.message : String(err),
			itemsProcessed: 0,
		};
	}
}

/**
 * Soft-delete unverified facts older than expiration threshold
 */
async function runExpireFacts(db: DB): Promise<Omit<TaskState, "taskName">> {
	const startTime = nowISO();

	try {
		// Get config for fact expiration (disabled by default)
		const expirationDays = await getConfig(db, "fact_expiration_days");
		if (!expirationDays) {
			return {
				lastRunAt: startTime,
				lastStatus: "skipped",
				lastMessage: "Fact expiration disabled (fact_expiration_days not set)",
				itemsProcessed: 0,
			};
		}

		const days = Number(expirationDays);
		if (Number.isNaN(days) || days <= 0) {
			return {
				lastRunAt: startTime,
				lastStatus: "skipped",
				lastMessage: "Invalid fact_expiration_days value",
				itemsProcessed: 0,
			};
		}

		const cutoffDate = daysAgoISO(days);

		// Soft-delete facts that:
		// - Are unverified
		// - Created before cutoff
		// - Have low retrieval count (not frequently accessed)
		const deleted = await deleteFacts(db, {
			olderThan: cutoffDate,
			unverifiedOnly: true,
			soft: true,
		});

		return {
			lastRunAt: startTime,
			lastStatus: "success",
			lastMessage: `Expired ${deleted} unverified facts older than ${days} days`,
			itemsProcessed: deleted,
		};
	} catch (err) {
		return {
			lastRunAt: startTime,
			lastStatus: "error",
			lastMessage: err instanceof Error ? err.message : String(err),
			itemsProcessed: 0,
		};
	}
}

/**
 * Prune orphan tags if auto-prune is enabled
 */
async function runPruneTags(db: DB): Promise<Omit<TaskState, "taskName">> {
	const startTime = nowISO();

	try {
		// Check if auto-prune is enabled
		const autoPrune = await getConfig(db, "auto_prune_orphan_tags");
		if (autoPrune !== "true") {
			return {
				lastRunAt: startTime,
				lastStatus: "skipped",
				lastMessage: "Auto prune disabled (auto_prune_orphan_tags not true)",
				itemsProcessed: 0,
			};
		}

		const result = await pruneOrphanTags(db, { dryRun: false });

		return {
			lastRunAt: startTime,
			lastStatus: "success",
			lastMessage: `Pruned ${result.pruned} orphan tags`,
			itemsProcessed: result.pruned,
		};
	} catch (err) {
		return {
			lastRunAt: startTime,
			lastStatus: "error",
			lastMessage: err instanceof Error ? err.message : String(err),
			itemsProcessed: 0,
		};
	}
}

/**
 * Hard-delete items that were soft-deleted beyond retention period
 */
async function runHardDelete(db: DB): Promise<Omit<TaskState, "taskName">> {
	const startTime = nowISO();

	try {
		// Get retention days config
		const retentionDaysStr = await getConfig(db, "soft_delete_retention_days");
		const retentionDays = retentionDaysStr
			? Math.max(1, Number(retentionDaysStr))
			: 7;

		const cutoffDate = daysAgoISO(retentionDays);
		let totalDeleted = 0;

		// Hard delete facts past retention
		const factsDeleted = await db
			.delete(facts)
			.where(and(isNotNull(facts.deletedAt), lt(facts.deletedAt, cutoffDate)))
			.returning({ id: facts.id });
		totalDeleted += factsDeleted.length;

		// Hard delete resources past retention
		const resourcesDeleted = await db
			.delete(resources)
			.where(
				and(
					isNotNull(resources.deletedAt),
					lt(resources.deletedAt, cutoffDate),
				),
			)
			.returning({ id: resources.id });
		totalDeleted += resourcesDeleted.length;

		// Hard delete skills past retention
		const skillsDeleted = await db
			.delete(skills)
			.where(and(isNotNull(skills.deletedAt), lt(skills.deletedAt, cutoffDate)))
			.returning({ id: skills.id });
		totalDeleted += skillsDeleted.length;

		return {
			lastRunAt: startTime,
			lastStatus: "success",
			lastMessage: `Hard deleted ${totalDeleted} items (${factsDeleted.length} facts, ${resourcesDeleted.length} resources, ${skillsDeleted.length} skills) older than ${retentionDays} days`,
			itemsProcessed: totalDeleted,
		};
	} catch (err) {
		return {
			lastRunAt: startTime,
			lastStatus: "error",
			lastMessage: err instanceof Error ? err.message : String(err),
			itemsProcessed: 0,
		};
	}
}

/**
 * Run all worker tasks based on their intervals, loading/saving state from DB
 */
async function runWorkerCycle(db: DB): Promise<void> {
	const tasks: Array<{
		name: TaskName;
		runner: (db: DB) => Promise<Omit<TaskState, "taskName">>;
	}> = [
		{ name: "autoVerify", runner: runAutoVerify },
		{ name: "expireFacts", runner: runExpireFacts },
		{ name: "pruneTags", runner: runPruneTags },
		{ name: "hardDelete", runner: runHardDelete },
	];

	for (const task of tasks) {
		// Load current state from database
		const currentState = await loadTaskState(db, task.name);
		const interval = await getTaskInterval(db, task.name);

		if (shouldRunTask(currentState, interval)) {
			console.log(`[worker] Running task: ${task.name}`);
			const result = await task.runner(db);

			// Save result to database
			await saveTaskState(db, {
				taskName: task.name,
				...result,
			});

			console.log(
				`[worker] ${task.name}: ${result.lastStatus} - ${result.lastMessage}`,
			);
		}
	}
}

/**
 * Main worker handler
 */
export const workerHandler: Handler = async (config) => {
	const db = createConnection(config.databaseUrl);
	await runMigrations(db);

	console.log("[worker] Starting background worker...");
	console.log(`[worker] Database: ${config.databaseUrl}`);
	console.log("[worker] State is persisted to database (survives restarts)");

	// Graceful shutdown handling
	let running = true;
	const shutdown = () => {
		console.log("\n[worker] Shutting down...");
		running = false;
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// Initial run
	await runWorkerCycle(db);

	// Polling interval (1 minute base interval, tasks have their own intervals)
	const pollIntervalMs = 60 * 1000;

	while (running) {
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		if (running) {
			await runWorkerCycle(db);
		}
	}

	console.log("[worker] Worker stopped.");
};
