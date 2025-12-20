# Factsets

|         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package | ![NPM Downloads](https://img.shields.io/npm/dm/factsets?style=flat) ![NPM Version](https://img.shields.io/npm/v/factsets?style=flat)                                                                                                                                                                                                                                                                                                                                       |
| CI/CD   | [![Release](https://github.com/joshua-auchincloss/factsets/actions/workflows/release.yaml/badge.svg)](https://github.com/joshua-auchincloss/factsets/actions) [![Tests](https://github.com/joshua-auchincloss/factsets/actions/workflows/test.yaml/badge.svg)](https://github.com/joshua-auchincloss/factsets/actions) [![codecov](https://codecov.io/gh/joshua-auchincloss/factsets/graph/badge.svg?token=IL8AIPFCX9)](https://codecov.io/gh/joshua-auchincloss/factsets) |

A self-maintaining knowledge base for AI agents, exposed via the
[Model Context Protocol (MCP)](https://modelcontextprotocol.io). Manages **facts** (atomic knowledge), **resources**
(cached external content), **skills** (procedural markdown), and **execution logs** (command history) using SQLite.

## Features

- **Persistent Context** - Knowledge survives across sessions
- **Self-Maintaining** - Staleness detection with refresh instructions
- **Tag-Based Organization** - Flexible categorization and retrieval
- **Skill Documents** - Markdown files for procedural knowledge
- **MCP Protocol** - Standard interface for AI tool/prompt definitions

## Installation

```bash
npm install --global factsets
pnpm install --global factsets
bun install --global factsets
```

## Quick Start

### As MCP Server

Add to your MCP client configuration (Claude Desktop, GitHub Copilot, Cursor, etc.):

```json
{
  "mcpServers": {
    "factsets": {
      "command": "bunx", // `bunx`, `npx` or `pnpm dlx`
      "args": ["factsets", "mcp-server"]
    }
  }
}
```

Or run directly:

```bash
bunx factsets mcp-server
```

### CLI Commands

```bash
# Start MCP server (auto-watches skill files and seeds starter content by default)
bunx factsets mcp-server [--database-url <path>] [--client <type>]

# Start without file watching
bunx factsets mcp-server --no-watch-skills

# Start without seeding starter content
bunx factsets mcp-server --no-seed

# Run file watcher standalone
bunx factsets watch-files [--database-url <path>]

# Export database to JSON
bunx factsets dump backup.json

# Restore database from JSON
bunx factsets restore backup.json
```

The `--client` flag configures where skill files are stored (e.g., `github-copilot` -> `.github/prompts/skills/`). If you want to change clients / your skill directory, do so through your agent which will migrate skills for you.

See [Configuration Guide](docs/config.md) for all options.

## Core Concepts

| Concept            | Description                                                                      |
| ------------------ | -------------------------------------------------------------------------------- |
| **Facts**          | Atomic knowledge units (1-3 sentences), tagged and timestamped                   |
| **Resources**      | External content (files, URLs, APIs) with cached snapshots and retrieval methods |
| **Skills**         | Markdown documents for procedural knowledge, stored on filesystem                |
| **Execution Logs** | Command history with success/failure tracking for skill validation               |
| **Tags**           | Flexible categorization for all content types                                    |

## MCP Tools

| Tool                        | Description                               |
| --------------------------- | ----------------------------------------- |
| `submit_facts`              | Add facts with tags and source tracking   |
| `search_facts`              | Query facts by tags, content, or filters  |
| `verify_facts`              | Mark facts as verified by ID              |
| `verify_facts_by_tags`      | Bulk verify facts by tags                 |
| `update_fact`               | Update fact content, metadata, or tags    |
| `delete_facts`              | Remove facts by criteria                  |
| `add_resources`             | Register resources with retrieval methods |
| `search_resources`          | Find resources by tags, type, or URI      |
| `get_resource`              | Get resource with freshness status        |
| `update_resource_snapshot`  | Update cached content                     |
| `update_resource_snapshots` | Bulk update snapshots                     |
| `delete_resources`          | Remove resources                          |
| `create_skill`              | Create markdown skill document            |
| `update_skill`              | Update skill metadata/references          |
| `search_skills`             | Find skills by tags or query              |
| `get_skill`                 | Get skill with content                    |
| `link_skill`                | Link skill to facts/resources/skills      |
| `sync_skill`                | Sync skill after file edit                |
| `delete_skills`             | Remove skills                             |
| `submit_execution_logs`     | Record command/test/build executions      |
| `search_execution_logs`     | Find executions by query, tags, success   |
| `get_execution_log`         | Get execution details by ID               |
| `check_stale`               | Find stale resources and dependencies     |
| `mark_resources_refreshed`  | Mark resources as current                 |
| `create_tags`               | Create organizational tags                |
| `list_tags`                 | List tags with usage counts               |
| `get_config` / `set_config` | Manage configuration                      |

## MCP Prompts

| Prompt               | Description                        |
| -------------------- | ---------------------------------- |
| `knowledge_context`  | Build context from tags            |
| `recall_skill`       | Get skill with references          |
| `maintenance_report` | Staleness summary                  |
| `refresh_guide`      | Instructions to refresh a resource |

## Documentation

- [Configuration Guide](docs/config.md) - CLI flags, client setup, and skills directory
- [Design Reference](docs/design.md) - Full API documentation
- [Concept](docs/concept.md) - Philosophy and design rationale
- [Agent Workflow](docs/facts-agent-flow.md) - How agents use Factsets

## Development

```bash
# Run tests
bun test

# Run full e2e (tests + build + dry run)
bun e2e

# Build distribution
bun dist

# Format code
bun format

# Lint
bun lint

# Generate database migrations
bun migrations

# Inspect MCP server with inspector
bun inspect
```
