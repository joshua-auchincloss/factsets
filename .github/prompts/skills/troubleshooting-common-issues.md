---
name: troubleshooting-common-issues
title: "Troubleshooting Common Issues"
description: "Solutions for common issues encountered when developing and deploying Factsets, including Drizzle migration ordering, CI/CD failures, and MCP transport problems."
tags:
  [
    "factsets",
    "debugging",
    "troubleshooting",
    "drizzle",
    "ci-cd",
    "best-practices",
  ]
updated: 2025-12-22
---

# Troubleshooting Common Issues

## Drizzle Migration Ordering (Linux/CI)

### Problem

Migrations run out of order on Linux CI systems but work locally on macOS.

### Root Cause

Linux ext4 filesystem does not guarantee alphabetical directory ordering when using `fs.readdirSync()`, unlike macOS HFS+/APFS. Without `meta/_journal.json`, Drizzle reads migration folders in arbitrary filesystem order.

### Solution

Ensure `src/db/migrations/meta/_journal.json` exists and contains proper entries:

```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1734567890123,
      "tag": "0001_worthless_meteorite",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1734567890456,
      "tag": "0002_uneven_strong_guy",
      "breakpoints": true
    }
  ]
}
```

### Prevention

Always run `bun run db:generate` which creates/updates the journal automatically. Never manually create migration folders.

---

## MCP Stdio Transport Corruption

### Problem

MCP server produces garbled output or client fails to parse responses.

### Root Cause

Console logs (console.log, console.info) sent to stdout interfere with JSON-RPC protocol.

### Solution

All logging must go to stderr:

```typescript
// WRONG
console.log("Debug message");

// CORRECT
console.error("Debug message");
process.stderr.write("Debug message\n");
```

### Prevention

Use the server's stderr for all diagnostic output. The MCP SDK handles protocol-level logging correctly.

---

## File Watcher Subprocess Errors in Tests

### Problem

MCP integration tests fail with subprocess spawn errors.

### Root Cause

The MCP server spawns a file watcher subprocess by default, which fails when running from test environment.

### Solution

Use `--no-watch-skills` flag in test harness:

```typescript
const client = new Client({ name: "test", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({
    command: "bun",
    args: [
      "src/main.ts",
      "mcp-server",
      "--database-url",
      "sqlite://:memory:",
      "--no-watch-skills",
    ], // Disable file watcher
  }),
);
```

---

## SIGINT/SIGTERM Double Cleanup

### Problem

Ctrl+C causes errors or hangs during shutdown.

### Root Cause

Signal handlers fire multiple times without cleanup guard.

### Solution

Use cleanup flag pattern:

```typescript
let isCleaningUp = false;

async function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;

  // Kill subprocess, close connections
  watcherProcess?.kill();
  db.close();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
```

---

## In-Memory Database Not Persisting

### Problem

Changes disappear between operations with `:memory:` database.

### Root Cause

Each `createConnection(":memory:")` creates a new isolated database.

### Solution

Reuse the same connection instance throughout the session:

```typescript
// Create once
const db = createConnection(":memory:");
await runMigrations(db);

// Pass to all operations
await submitFacts(db, facts);
await searchFacts(db, query);
```

---

## Resource Staleness False Positives

### Problem

Resources marked stale immediately after update.

### Root Cause

Freshness threshold too aggressive for resource type.

### Solution

Adjust category-specific thresholds:

```bash
# Via MCP tool
set_config key="freshness_threshold_documentation" value="168"  # 1 week
set_config key="freshness_threshold_source_code" value="24"     # 1 day
```

Or use `maxAgeHours` parameter in `check_stale` for one-time override.

---

## Tag Expansion Not Working

### Problem

Search with synonym/child tag returns no results.

### Root Cause

Tag expansion disabled or not configured.

### Solution

1. Verify expansion is enabled:

   ```
   get_config key="tag_expansion_search_facts"  // Should be true
   ```

2. Configure synonyms/hierarchy:
   ```
   set_config key="tag_synonyms" value='{"py":"python","ts":"typescript"}'
   set_config key="tag_hierarchy" value='{"backend":["python","node","go"]}'
   ```

---

## Skills Not Auto-Syncing

### Problem

File changes not reflected in database.

### Root Cause

File watcher not running or watching wrong directory.

### Solution

1. Check watcher is enabled: `--watch-skills=true` (default)
2. Verify skills directory: `get_config key="skills_dir"`
3. Manually sync: `sync_skill name="skill-name"`
4. Check for errors in stderr output

---

## Cursor-Based Pagination Returning Duplicates

### Problem

Same items appear across pages.

### Root Cause

Data modified between pagination requests.

### Solution

Use consistent ordering (`orderBy`) and avoid mutations during pagination. For critical operations, fetch all results in single query with higher limit.
