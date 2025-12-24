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
- **User Preferences** - Configurable output style and agent behavior
- **MCP Protocol** - Standard interface for AI tool/prompt definitions

## Installation

```bash
npm install --global factsets
pnpm install --global factsets
bun install --global factsets
```

## Quick Start

### As MCP Server

Add to your MCP client configuration (Claude Desktop, GitHub Copilot, Cursor, etc.), using `bunx`, `npx` or `pnpm dlx` accordingly:

```json
{
  "mcpServers": {
    "factsets": {
      "command": "bunx",
      "args": ["factsets", "mcp-server"]
    }
  }
}
```

Or run directly:

```bash
bunx factsets mcp-server
```

### First-Time Setup

After adding Factsets to your MCP client, run the setup prompt to integrate it into your project:

**In a supported IDE**: Type `/mcp.factsets.setup` in the chat to run the guided setup

**In other clients**: Call the `get_setup_guide` tool or use the `setup` prompt

The setup guide will:

- Analyze your project structure and establish baseline facts
- Configure the skills directory for your AI client
- Create or update `AGENTS.md` with Factsets instructions
- Migrate any existing skills with Factsets integration
- Register key configuration files as resources

This one-time setup ensures agents have full context on every future interaction.

### CLI Commands

```bash
# Start MCP server (default command - auto-watches skill files and seeds starter content)
bunx factsets [--database-url <path>] [--client <type>]

# Explicit mcp-server command (same as above)
bunx factsets mcp-server [--database-url <path>] [--client <type>]

# Start without file watching
bunx factsets --no-watch-skills

# Start without seeding starter content
bunx factsets --no-seed

# Run file watcher standalone
bunx factsets watch-files [--database-url <path>]

# Run background maintenance worker
bunx factsets worker [--database-url <path>]

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

### Facts

| Tool                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `submit_facts`         | Add facts with tags and source tracking  |
| `search_facts`         | Query facts by tags, content, or filters |
| `verify_facts`         | Mark facts as verified by ID             |
| `verify_facts_by_tags` | Bulk verify facts by tags                |
| `update_fact`          | Update fact content, metadata, or tags   |
| `delete_facts`         | Remove facts by criteria                 |
| `restore_facts`        | Restore soft-deleted facts               |

### Resources

| Tool                        | Description                               |
| --------------------------- | ----------------------------------------- |
| `add_resources`             | Register resources with retrieval methods |
| `search_resources`          | Find resources by tags, type, or URI      |
| `get_resources`             | Get resources by ID or URI with freshness |
| `update_resource_snapshot`  | Update cached content for single resource |
| `update_resource_snapshots` | Bulk update cached content                |
| `update_resource`           | Update resource metadata (not content)    |
| `delete_resources`          | Remove resources                          |
| `restore_resources`         | Restore soft-deleted resources            |

### Skills

| Tool                   | Description                          |
| ---------------------- | ------------------------------------ |
| `create_skill`         | Create markdown skill document       |
| `update_skill`         | Update skill metadata/references     |
| `search_skills`        | Find skills by tags or query         |
| `get_skills`           | Get skills by name with content      |
| `link_skill`           | Link skill to facts/resources/skills |
| `sync_skill`           | Sync skill after file edit           |
| `delete_skills`        | Remove skills                        |
| `get_dependency_graph` | Get skill dependency tree            |
| `restore_skills`       | Restore soft-deleted skills          |

### Execution Logs

| Tool                    | Description                             |
| ----------------------- | --------------------------------------- |
| `submit_execution_logs` | Record command/test/build executions    |
| `search_execution_logs` | Find executions by query, tags, success |
| `get_execution_log`     | Get execution details by ID             |

### Tags

| Tool                | Description                 |
| ------------------- | --------------------------- |
| `create_tags`       | Create organizational tags  |
| `list_tags`         | List tags with usage counts |
| `update_tags`       | Update tag descriptions     |
| `prune_orphan_tags` | Clean up unused orphan tags |

### Configuration

| Tool                | Description                             |
| ------------------- | --------------------------------------- |
| `get_config`        | Get a configuration value by key        |
| `set_config`        | Set a configuration value               |
| `delete_config`     | Delete a configuration value            |
| `list_config`       | List all configuration with schema      |
| `get_config_schema` | Get available options with descriptions |

### User Preferences

| Tool                    | Description                            |
| ----------------------- | -------------------------------------- |
| `get_preference_prompt` | Get natural language preference prompt |
| `get_user_preferences`  | Get structured preference data         |
| `infer_preference`      | Update preference from user behavior   |
| `reset_preferences`     | Reset preferences to defaults          |

### Maintenance

| Tool                       | Description                           |
| -------------------------- | ------------------------------------- |
| `check_stale`              | Find stale resources and dependencies |
| `mark_resources_refreshed` | Mark resources as current             |

### Context & Guides

| Tool                     | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `get_knowledge_context`  | Build context from tags (facts/resources/skills) |
| `build_skill_context`    | Get skill with formatted content and refs        |
| `get_maintenance_report` | Generate staleness/maintenance report            |
| `get_refresh_guide`      | Get instructions for refreshing a resource       |
| `get_agent_guide`        | Get the agent workflow guide (call first)        |
| `get_concept_guide`      | Get conceptual overview and design philosophy    |
| `get_config_guide`       | Get configuration guide with all options         |

## MCP Prompts

| Prompt               | Description                                |
| -------------------- | ------------------------------------------ |
| `setup`              | Guided setup for new project integration   |
| `user_preferences`   | Get user preferences for output formatting |
| `knowledge_context`  | Build context from tags                    |
| `recall_skill`       | Get skill with references                  |
| `maintenance_report` | Staleness summary                          |
| `refresh_guide`      | Instructions to refresh a resource         |
| `agent_guide`        | Agent workflow guide (call first)          |
| `concept`            | Conceptual overview and philosophy         |
| `config`             | Configuration guide with all options       |

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
