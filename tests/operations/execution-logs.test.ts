import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import {
	submitExecutionLogs,
	searchExecutionLogs,
	getExecutionLog,
} from "../../src/db/operations/execution-logs";
import { createTags } from "../../src/db/operations/tags";
import { setConfig } from "../../src/db/operations/config";

describe("execution logs operations", () => {
	let db: TestDB;

	beforeEach(async () => {
		db = await createTestDb();
		await setConfig(db, "skills_dir", "/tmp/factsets-test");
	});

	describe("submitExecutionLogs", () => {
		it("creates a basic execution log", async () => {
			const result = await submitExecutionLogs(db, {
				logs: [
					{
						command: "bun test",
						success: true,
						output: "All tests passed",
						exitCode: 0,
					},
				],
			});

			expect(result.created).toBe(1);
			expect(result.ids).toHaveLength(1);
			expect(result.ids[0]).toBeGreaterThan(0);
		});

		it("creates execution log with all fields", async () => {
			const result = await submitExecutionLogs(db, {
				logs: [
					{
						command: "bun drizzle-kit generate",
						workingDirectory: "/app",
						context: "Generated migration for new table",
						output: "1 migration file created",
						exitCode: 0,
						success: true,
						durationMs: 1500,
						skillName: "database-migrations",
					},
				],
			});

			expect(result.created).toBe(1);
			const logId = result.ids[0]!;

			// Verify by fetching
			const log = await getExecutionLog(db, { id: logId });
			expect(log).not.toBeNull();
			expect(log!.command).toBe("bun drizzle-kit generate");
			expect(log!.workingDirectory).toBe("/app");
			expect(log!.context).toBe("Generated migration for new table");
			expect(log!.output).toBe("1 migration file created");
			expect(log!.exitCode).toBe(0);
			expect(log!.durationMs).toBe(1500);
			expect(log!.skillName).toBe("database-migrations");
		});

		it("creates execution log with tags", async () => {
			await createTags(db, {
				tags: [
					{ name: "database", description: "Database operations" },
					{ name: "migrations", description: "Schema migrations" },
				],
			});

			const result = await submitExecutionLogs(db, {
				logs: [
					{
						command: "bun drizzle-kit push",
						success: true,
						tags: ["database", "migrations"],
					},
				],
			});

			expect(result.created).toBe(1);

			// Verify tags by fetching
			const log = await getExecutionLog(db, { id: result.ids[0]! });
			expect(log!.tags).toContain("database");
			expect(log!.tags).toContain("migrations");
		});

		it("creates multiple execution logs at once", async () => {
			const result = await submitExecutionLogs(db, {
				logs: [
					{ command: "bun install", success: true, exitCode: 0 },
					{ command: "bun test", success: true, exitCode: 0 },
					{ command: "bun build", success: false, exitCode: 1 },
				],
			});

			expect(result.created).toBe(3);
			expect(result.ids).toHaveLength(3);
		});

		it("records failed execution", async () => {
			const result = await submitExecutionLogs(db, {
				logs: [
					{
						command: "rm -rf /nonexistent",
						success: false,
						exitCode: 1,
						output: "No such file or directory",
						context: "Attempted cleanup but path did not exist",
					},
				],
			});

			const log = await getExecutionLog(db, { id: result.ids[0]! });
			expect(log!.success).toBe(false);
			expect(log!.exitCode).toBe(1);
		});
	});

	describe("searchExecutionLogs", () => {
		beforeEach(async () => {
			await createTags(db, {
				tags: [
					{ name: "testing", description: "Testing related" },
					{ name: "database", description: "Database operations" },
				],
			});

			await submitExecutionLogs(db, {
				logs: [
					{
						command: "bun test",
						success: true,
						context: "Unit tests",
						output: "42 tests passed",
						tags: ["testing"],
						skillName: "run-tests",
					},
					{
						command: "bun test:integration",
						success: false,
						context: "Integration tests",
						output: "Connection refused",
						tags: ["testing"],
						skillName: "run-tests",
					},
					{
						command: "bun drizzle-kit generate",
						success: true,
						context: "Schema migration",
						output: "Migration created",
						tags: ["database"],
						skillName: "database-migrations",
					},
				],
			});
		});

		it("searches all logs by default", async () => {
			const result = await searchExecutionLogs(db, {});
			expect(result.logs.length).toBeGreaterThanOrEqual(3);
		});

		it("filters by success status", async () => {
			const successful = await searchExecutionLogs(db, { success: true });
			expect(successful.logs.every((l) => l.success)).toBe(true);
			expect(successful.logs.length).toBe(2);

			const failed = await searchExecutionLogs(db, { success: false });
			expect(failed.logs.every((l) => !l.success)).toBe(true);
			expect(failed.logs.length).toBe(1);
		});

		it("filters by skill name", async () => {
			const result = await searchExecutionLogs(db, {
				skillName: "run-tests",
			});

			expect(result.logs).toHaveLength(2);
			expect(result.logs.every((l) => l.skillName === "run-tests")).toBe(true);
		});

		it("filters by tags", async () => {
			const result = await searchExecutionLogs(db, {
				tags: ["database"],
			});

			expect(result.logs).toHaveLength(1);
			expect(result.logs[0]!.command).toBe("bun drizzle-kit generate");
		});

		it("searches by query in command", async () => {
			const result = await searchExecutionLogs(db, {
				query: "drizzle",
			});

			expect(result.logs).toHaveLength(1);
			expect(result.logs[0]!.command).toContain("drizzle");
		});

		it("searches by query in context", async () => {
			const result = await searchExecutionLogs(db, {
				query: "Integration",
			});

			expect(result.logs).toHaveLength(1);
			expect(result.logs[0]!.context).toContain("Integration");
		});

		it("searches by query in output", async () => {
			const result = await searchExecutionLogs(db, {
				query: "Connection refused",
			});

			expect(result.logs).toHaveLength(1);
			expect(result.logs[0]!.success).toBe(false);
		});

		it("combines filters", async () => {
			const result = await searchExecutionLogs(db, {
				skillName: "run-tests",
				success: true,
			});

			expect(result.logs).toHaveLength(1);
			expect(result.logs[0]!.command).toBe("bun test");
		});

		it("orders by recent first by default", async () => {
			const result = await searchExecutionLogs(db, {});
			// Most recent first
			const ids = result.logs.map((l) => l.id);
			expect(ids).toEqual([...ids].sort((a, b) => b - a));
		});

		it("orders by oldest first", async () => {
			const result = await searchExecutionLogs(db, { orderBy: "oldest" });
			const ids = result.logs.map((l) => l.id);
			expect(ids).toEqual([...ids].sort((a, b) => a - b));
		});

		it("limits results", async () => {
			const result = await searchExecutionLogs(db, { limit: 2 });
			expect(result.logs).toHaveLength(2);
		});

		it("paginates with cursor", async () => {
			// Create 5 logs to ensure pagination works
			await submitExecutionLogs(db, {
				logs: [
					{ command: "cmd1", success: true },
					{ command: "cmd2", success: true },
					{ command: "cmd3", success: true },
					{ command: "cmd4", success: true },
					{ command: "cmd5", success: true },
				],
			});

			const page1 = await searchExecutionLogs(db, { limit: 2 });
			expect(page1.logs).toHaveLength(2);
			// Should have more items, so cursor defined
			expect(page1.nextCursor).toBeDefined();

			const page2 = await searchExecutionLogs(db, {
				limit: 2,
				cursor: page1.nextCursor,
			});
			expect(page2.logs).toHaveLength(2);

			// Verify different logs
			const page1Ids = page1.logs.map((l) => l.id);
			const page2Ids = page2.logs.map((l) => l.id);
			expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
		});
	});

	describe("getExecutionLog", () => {
		it("retrieves execution log by id", async () => {
			const submitted = await submitExecutionLogs(db, {
				logs: [
					{
						command: "bun test",
						success: true,
						output: "All passed",
						exitCode: 0,
						context: "Running unit tests",
						durationMs: 3000,
						skillName: "run-tests",
					},
				],
			});

			const id = submitted.ids[0]!;
			const result = await getExecutionLog(db, { id });

			expect(result).not.toBeNull();
			expect(result!.id).toBe(id);
			expect(result!.command).toBe("bun test");
			expect(result!.success).toBe(true);
			expect(result!.output).toBe("All passed");
			expect(result!.exitCode).toBe(0);
			expect(result!.context).toBe("Running unit tests");
			expect(result!.durationMs).toBe(3000);
			expect(result!.skillName).toBe("run-tests");
		});

		it("retrieves execution log with tags", async () => {
			await createTags(db, {
				tags: [{ name: "testing", description: "Testing" }],
			});

			const submitted = await submitExecutionLogs(db, {
				logs: [
					{
						command: "bun test",
						success: true,
						tags: ["testing"],
					},
				],
			});

			const result = await getExecutionLog(db, { id: submitted.ids[0]! });
			expect(result!.tags).toContain("testing");
		});

		it("returns null for non-existent id", async () => {
			const result = await getExecutionLog(db, { id: 99999 });
			expect(result).toBeNull();
		});
	});

	describe("skill integration", () => {
		it("execution log can be referenced by skill name", async () => {
			// Create multiple logs for a skill
			await submitExecutionLogs(db, {
				logs: [
					{
						command: "bun test",
						success: true,
						skillName: "run-tests",
					},
					{
						command: "bun test --coverage",
						success: true,
						skillName: "run-tests",
					},
				],
			});

			// Search for logs related to the skill
			const result = await searchExecutionLogs(db, {
				skillName: "run-tests",
				success: true,
			});

			expect(result.logs).toHaveLength(2);
		});

		it("can find successful command history for skill re-validation", async () => {
			await submitExecutionLogs(db, {
				logs: [
					{
						command: "bun drizzle-kit generate",
						success: true,
						context: "Initial migration",
						skillName: "database-migrations",
					},
					{
						command: "bun drizzle-kit generate",
						success: false,
						context: "Failed attempt",
						output: "No schema changes",
						skillName: "database-migrations",
					},
					{
						command: "bun drizzle-kit push",
						success: true,
						context: "Apply migration",
						skillName: "database-migrations",
					},
				],
			});

			// Get only successful executions for re-validation
			const result = await searchExecutionLogs(db, {
				skillName: "database-migrations",
				success: true,
				orderBy: "recent",
			});

			expect(result.logs).toHaveLength(2);
			// Both successful commands should be present
			const commands = result.logs.map((l) => l.command);
			expect(commands).toContain("bun drizzle-kit push");
			expect(commands).toContain("bun drizzle-kit generate");
		});
	});
});
