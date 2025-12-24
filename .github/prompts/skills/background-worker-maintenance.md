---
name: background-worker-maintenance
title: "Background Worker for Automated Maintenance"
description: "Guide to the Factsets background worker for automated maintenance including staleness checks, orphan tag pruning, and unverified fact cleanup with durable database-persisted state."
tags: ["factsets", "background-worker", "maintenance", "automation"]
updated: 2025-12-21
---

# Background Worker for Automated Maintenance

## Overview

Factsets includes an optional background worker that runs periodic maintenance tasks automatically. The worker uses durable database-persisted state, enabling seamless resume after server restart.

## Enabling the Worker

```bash
# Start with watch-files command
bunx factsets watch-files --background-worker

# Or with MCP server (implicitly via watch-files subprocess)
bunx factsets mcp-server --background-worker
```

## Maintenance Tasks

### 1. Staleness Check

**Interval:** `worker_interval_staleness_check` (default 1 hour)

Scans all resources and identifies:

- **Stale resources** - Exceeded freshness threshold
- **Approaching stale** - Past warning threshold (default 80% of limit)
- **Skills with stale deps** - Skills referencing stale resources

Results logged but no automatic action taken - agents handle refresh.

### 2. Orphan Tag Pruning

**Interval:** `worker_interval_orphan_prune` (default 24 hours)

Removes tags with zero usage across all junction tables:

- `factTags`
- `resourceTags`
- `skillTags`
- `executionLogTags`

Keeps the knowledge base clean without manual intervention.

### 3. Unverified Fact Cleanup

**Interval:** `worker_interval_unverified_cleanup` (default 1 week)

Identifies unverified facts older than the cleanup threshold. Currently logs warnings only - actual deletion requires manual confirmation to prevent data loss.

## Durable State

Worker state is persisted in the `worker_state` database table:

```sql
CREATE TABLE worker_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

State keys tracked:

- `last_staleness_check` - Timestamp of last staleness scan
- `last_orphan_prune` - Timestamp of last tag cleanup
- `last_unverified_cleanup` - Timestamp of last fact review

This enables:

- Resume from last known state after restart
- Prevent duplicate work if restarted frequently
- Track maintenance history

## Configuration

| Config Key                           | Default (ms)    | Description                |
| ------------------------------------ | --------------- | -------------------------- |
| `worker_interval_staleness_check`    | 3600000 (1h)    | Staleness scan interval    |
| `worker_interval_orphan_prune`       | 86400000 (24h)  | Orphan cleanup interval    |
| `worker_interval_unverified_cleanup` | 604800000 (1wk) | Unverified review interval |

Adjust via `set_config`:

```
set_config key="worker_interval_staleness_check" value="1800000"  # 30 min
```

## Architecture

```
watch-files command
├── File Watcher (skill auto-sync)
│   ├── Directory watcher for new .md files
│   └── Per-file watchers for content changes
│
└── Background Worker (if --background-worker)
    ├── Staleness Check Timer
    ├── Orphan Prune Timer
    └── Unverified Cleanup Timer
```

The worker runs in the same process as the file watcher, sharing the database connection.

## Best Practices

1. **Enable in production** - Set `--background-worker` in your MCP server config
2. **Monitor logs** - Worker logs task completions and findings
3. **Tune intervals** for your usage pattern:
   - High-activity projects: shorter staleness checks
   - Stable knowledge bases: longer intervals to reduce overhead
4. **Don't rely on auto-cleanup** for important facts - verify them instead

## Troubleshooting

### Worker not running

Check if `--background-worker` flag is set. Verify with logs showing task scheduling.

### Tasks running too frequently

Worker state may be corrupted. Delete `worker_state` rows to reset:

```sql
DELETE FROM worker_state;
```

### Missing state persistence

Ensure database is writable. Worker silently fails state updates if DB is read-only.

## References

- [src/commands/watch-files.ts](src/commands/watch-files.ts) - Worker implementation
- [src/db/schema.ts](src/db/schema.ts) - worker_state table definition
- [docs/design.md](docs/design.md) - API documentation
