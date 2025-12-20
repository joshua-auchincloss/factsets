# Factsets MCP Server Reference

A self-maintaining knowledge base exposed via the Model Context Protocol (MCP). Stores facts, resources, and skills in
SQLite for agent context persistence.

## Quick Start

### Installation

```bash
npm install factsets
# or
bun add factsets
```

### MCP Client Configuration

Add to your MCP client configuration:

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

## Configuration

### `set_config`

Set a configuration value.

**Parameters:**

| Name    | Type   | Required | Description         |
| ------- | ------ | -------- | ------------------- |
| `key`   | string | ✓        | Configuration key   |
| `value` | string | ✓        | Configuration value |

**Common Keys:**

| Key          | Values                                                   | Description                               |
| ------------ | -------------------------------------------------------- | ----------------------------------------- |
| `client`     | `github-copilot`, `cursor`, `windsurf`, `claude-desktop` | Client type (determines skills directory) |
| `skills_dir` | path                                                     | Override default skills directory         |

**Example:**

```json
{ "key": "client", "value": "github-copilot" }
```

### `get_config`

Get a configuration value.

**Parameters:**

| Name  | Type   | Required | Description       |
| ----- | ------ | -------- | ----------------- |
| `key` | string | ✓        | Configuration key |

### `delete_config`

Delete a configuration value.

**Parameters:**

| Name  | Type   | Required | Description       |
| ----- | ------ | -------- | ----------------- |
| `key` | string | ✓        | Configuration key |

### `list_config`

List all configuration values.

**Parameters:** None

## Tags

Tags organize facts, resources, and skills. Create tags first, then use them when submitting content.

### `create_tags`

Create one or more tags.

**Parameters:**

| Name                 | Type   | Required | Description          |
| -------------------- | ------ | -------- | -------------------- |
| `tags`               | array  | ✓        | Array of tag objects |
| `tags[].name`        | string | ✓        | Tag name             |
| `tags[].description` | string |          | Optional description |

**Example:**

```json
{
  "tags": [
    { "name": "database", "description": "Database-related knowledge" },
    { "name": "api" }
  ]
}
```

### `list_tags`

List tags with optional filtering.

**Parameters:**

| Name      | Type    | Required | Default | Description                           |
| --------- | ------- | -------- | ------- | ------------------------------------- |
| `filter`  | string  |          |         | Filter by name pattern                |
| `limit`   | integer |          | 100     | Maximum results                       |
| `orderBy` | enum    |          | "usage" | Sort order: "usage", "name", "recent" |

## Facts

Atomic knowledge units (1-3 sentences). Facts are upserted—matching content updates instead of duplicating.

### `submit_facts`

Submit one or more facts.

**Parameters:**

| Name                 | Type     | Required | Description                                  |
| -------------------- | -------- | -------- | -------------------------------------------- |
| `facts`              | array    | ✓        | Array of fact objects                        |
| `facts[].content`    | string   | ✓        | The fact itself                              |
| `facts[].tags`       | string[] | ✓        | Tags for categorization                      |
| `facts[].source`     | string   |          | Where the fact came from                     |
| `facts[].sourceType` | enum     |          | `user`, `documentation`, `code`, `inference` |
| `facts[].verified`   | boolean  |          | Default: `false`                             |

**Example:**

```json
{
  "facts": [
    {
      "content": "The API uses JWT tokens with 24-hour expiration",
      "tags": ["api", "auth"],
      "sourceType": "documentation",
      "verified": true
    }
  ]
}
```

### `search_facts`

Search facts by tags, query, or filters.

**Parameters:**

| Name           | Type     | Required | Default  | Description                             |
| -------------- | -------- | -------- | -------- | --------------------------------------- |
| `tags`         | string[] |          |          | Filter by tags                          |
| `query`        | string   |          |          | Text search in content                  |
| `limit`        | integer  |          | 50       | Maximum results                         |
| `orderBy`      | enum     |          | "recent" | Sort order: "recent", "oldest", "usage" |
| `verifiedOnly` | boolean  |          |          | Only verified facts                     |
| `sourceType`   | enum     |          |          | Filter by source type                   |

### `verify_facts`

Mark facts as verified.

**Parameters:**

| Name  | Type      | Required | Description        |
| ----- | --------- | -------- | ------------------ |
| `ids` | integer[] | ✓        | Fact IDs to verify |

### `delete_facts`

Delete facts by various criteria.

**Parameters:**

| Name             | Type      | Required | Description                  |
| ---------------- | --------- | -------- | ---------------------------- |
| `ids`            | integer[] |          | Specific fact IDs            |
| `tags`           | string[]  |          | Delete facts with these tags |
| `olderThan`      | datetime  |          | Delete facts older than this |
| `unverifiedOnly` | boolean   |          | Only delete unverified facts |

### `update_fact`

Update an existing fact's content, metadata, or tags.

**Parameters:**

| Name                  | Type     | Required | Description                                |
| --------------------- | -------- | -------- | ------------------------------------------ |
| `id`                  | integer  | \*       | Fact ID to update                          |
| `contentMatch`        | string   | \*       | Match fact by exact content instead of ID  |
| `updates`             | object   | ✓        | Fields to update                           |
| `updates.content`     | string   |          | New content                                |
| `updates.source`      | string   |          | New source                                 |
| `updates.sourceType`  | enum     |          | New source type                            |
| `updates.verified`    | boolean  |          | Set verification status                    |
| `updates.tags`        | string[] |          | Replace all tags                           |
| `updates.appendTags`  | string[] |          | Add tags without removing existing         |
| `updates.removeTags`  | string[] |          | Remove specific tags                       |

\*One of `id` or `contentMatch` is required.

**Example:**

```json
{
  "id": 42,
  "updates": {
    "content": "Updated fact content",
    "verified": true,
    "appendTags": ["reviewed"]
  }
}
```

### `verify_facts_by_tags`

Bulk verify all facts matching specified tags.

**Parameters:**

| Name         | Type     | Required | Default | Description                                        |
| ------------ | -------- | -------- | ------- | -------------------------------------------------- |
| `tags`       | string[] | ✓        |         | Tags to match                                      |
| `requireAll` | boolean  |          | false   | If true, only verify facts with ALL specified tags |

**Example:**

```json
// Verify all facts with "api" OR "auth" tags
{ "tags": ["api", "auth"] }

// Verify only facts with BOTH "api" AND "auth" tags
{ "tags": ["api", "auth"], "requireAll": true }
```

**Returns:**

```json
{
  "verified": 5,
  "factIds": [1, 2, 3, 4, 5]
}
```

## Resources

External content references with cached snapshots. The system stores retrieval methods—actual fetching is performed by
the agent.

### `add_resources`

Register resources with retrieval methods.

**Parameters:**

| Name                          | Type     | Required | Description                     |
| ----------------------------- | -------- | -------- | ------------------------------- |
| `resources`                   | array    | ✓        | Array of resource objects       |
| `resources[].uri`             | string   | ✓        | Location (path, URL, etc.)      |
| `resources[].type`            | enum     | ✓        | `file`, `url`, `api`, `command` |
| `resources[].tags`            | string[] | ✓        | Tags for categorization         |
| `resources[].snapshot`        | string   |          | Initial cached content          |
| `resources[].retrievalMethod` | object   |          | How to refresh                  |

**Retrieval Method:**

| Name      | Type   | Description                            |
| --------- | ------ | -------------------------------------- |
| `type`    | string | Method type                            |
| `command` | string | Shell command (for file/command types) |
| `url`     | string | URL to fetch (for url/api types)       |
| `headers` | object | HTTP headers                           |

**Example:**

```json
{
  "resources": [
    {
      "uri": "https://api.example.com/docs",
      "type": "url",
      "tags": ["api", "documentation"],
      "retrievalMethod": {
        "type": "fetch",
        "url": "https://api.example.com/docs"
      }
    },
    {
      "uri": "./config/settings.json",
      "type": "file",
      "tags": ["config"],
      "retrievalMethod": {
        "type": "file",
        "command": "cat ./config/settings.json"
      }
    }
  ]
}
```

### `search_resources`

Search resources by tags, type, or URI pattern.

**Parameters:**

| Name         | Type     | Required | Default  | Description                             |
| ------------ | -------- | -------- | -------- | --------------------------------------- |
| `tags`       | string[] |          |          | Filter by tags                          |
| `type`       | enum     |          |          | `file`, `url`, `api`, `command`         |
| `uriPattern` | string   |          |          | URI pattern to match                    |
| `limit`      | integer  |          | 100      | Maximum results                         |
| `orderBy`    | enum     |          | "recent" | Sort order: "recent", "oldest", "fresh" |

### `get_resource`

Get a specific resource with its snapshot.

**Parameters:**

| Name          | Type    | Required | Default | Description                                      |
| ------------- | ------- | -------- | ------- | ------------------------------------------------ |
| `id`          | integer | \*       |         | Resource ID                                      |
| `uri`         | string  | \*       |         | Resource URI                                     |
| `maxAgeHours` | integer |          | 1       | Hours before content is considered stale         |

\*One of `id` or `uri` is required.

**Returns:**

- `uri`: Resource location
- `type`: Resource type
- `content`: Cached snapshot
- `isFresh`: Whether snapshot is within freshnessThresholdHours
- `snapshotAgeSeconds`: Age of snapshot
- `retrievalMethod`: How to refresh

### `update_resource_snapshot`

Update cached content after fetching fresh data.

**Parameters:**

| Name       | Type    | Required | Description        |
| ---------- | ------- | -------- | ------------------ |
| `id`       | integer | \*       | Resource ID        |
| `uri`      | string  | \*       | Resource URI       |
| `snapshot` | string  | ✓        | New cached content |

\*One of `id` or `uri` is required.

### `update_resource_snapshots`

Bulk update cached content for multiple resources.

**Parameters:**

| Name                     | Type    | Required | Description               |
| ------------------------ | ------- | -------- | ------------------------- |
| `snapshots`              | array   | ✓        | Array of snapshot updates |
| `snapshots[].resourceId` | integer | ✓        | Resource ID               |
| `snapshots[].snapshot`   | string  | ✓        | New cached content        |

**Example:**

```json
{
  "snapshots": [
    { "resourceId": 1, "snapshot": "updated content 1" },
    { "resourceId": 2, "snapshot": "updated content 2" }
  ]
}
```

### `delete_resources`

Delete resources by ID or URI.

**Parameters:**

| Name   | Type      | Required | Description             |
| ------ | --------- | -------- | ----------------------- |
| `ids`  | integer[] | \*       | Resource IDs to delete  |
| `uris` | string[]  | \*       | Resource URIs to delete |

\*One of `ids` or `uris` is required.

**Returns:**

```json
{
  "deleted": 3
}
```

## Skills

Markdown documents capturing procedural knowledge. Skills can reference other skills, resources, and facts.

### `create_skill`

Create a skill document.

**Parameters:**

| Name                   | Type      | Required | Description                                              |
| ---------------------- | --------- | -------- | -------------------------------------------------------- |
| `name`                 | string    | ✓        | Unique identifier (lowercase, alphanumeric with dashes)  |
| `title`                | string    | ✓        | Human-readable title                                     |
| `description`          | string    |          | Brief description                                        |
| `content`              | string    | ✓        | Markdown content                                         |
| `tags`                 | string[]  | ✓        | Tags for categorization                                  |
| `references`           | object    |          | Initial references                                       |
| `references.skills`    | string[]  |          | Names of related skills                                  |
| `references.resources` | integer[] |          | Resource IDs                                             |
| `references.facts`     | integer[] |          | Fact IDs                                                 |
| `executionLogId`       | integer   |          | ID of execution log that validated this skill            |

**Example:**

```json
{
  "name": "deploy-to-production",
  "title": "Production Deployment Guide",
  "content": "# Deploy to Production\n\n## Prerequisites\n...",
  "tags": ["deployment", "devops"],
  "references": {
    "skills": ["docker-basics"],
    "resources": [1, 2]
  },
  "executionLogId": 42
}
```

### `update_skill`

Update a skill's metadata, tags, or references. Does not modify file content - use `sync_skill` after editing the file
directly.

**Parameters:**

| Name             | Type     | Required | Description                                   |
| ---------------- | -------- | -------- | --------------------------------------------- |
| `name`           | string   | ✓        | Skill name                                    |
| `title`          | string   |          | New title                                     |
| `description`    | string   |          | New description                               |
| `tags`           | string[] |          | Replace all tags                              |
| `appendTags`     | string[] |          | Add tags (keeps existing)                     |
| `references`     | object   |          | Modify references                             |
| `executionLogId` | integer  |          | ID of execution log that validated this skill |

**Reference Updates:**

```json
{
  "name": "my-skill",
  "references": {
    "skills": { "add": ["new-skill"], "remove": ["old-skill"] },
    "resources": { "add": [5] },
    "facts": { "remove": [3] }
  }
}
```

### `sync_skill`

Sync a skill's content hash after the file has been modified externally. Call this after editing the skill file
directly.

**Parameters:**

| Name   | Type   | Required | Description |
| ------ | ------ | -------- | ----------- |
| `name` | string | ✓        | Skill name  |

**Returns:**

```json
{
  "name": "my-skill",
  "contentHash": "abc123...",
  "updated": true
}
```

### `delete_skills`

Delete skills by name. Optionally delete the skill files from disk.

**Parameters:**

| Name          | Type     | Required | Default | Description                  |
| ------------- | -------- | -------- | ------- | ---------------------------- |
| `names`       | string[] | ✓        |         | Skill names to delete        |
| `deleteFiles` | boolean  |          | false   | Delete skill files from disk |

**Returns:**

```json
{
  "deleted": 2,
  "filesDeleted": 2
}
```

### `search_skills`

Search skills by tags or title.

**Parameters:**

| Name      | Type     | Required | Default  | Description                            |
| --------- | -------- | -------- | -------- | -------------------------------------- |
| `tags`    | string[] |          |          | Filter by tags                         |
| `query`   | string   |          |          | Search title                           |
| `limit`   | integer  |          | 30       | Maximum results                        |
| `orderBy` | enum     |          | "recent" | Sort order: "recent", "oldest", "name" |

**Returns:** Skills with `hasStaleDeps` flag indicating stale dependencies.

### `get_skill`

Retrieve a skill with full content.

**Parameters:**

| Name          | Type    | Required | Default | Description                      |
| ------------- | ------- | -------- | ------- | -------------------------------- |
| `name`        | string  | ✓        |         | Skill name                       |
| `hydrateRefs` | boolean |          | false   | Include referenced skill content |

### `link_skill`

Add references from a skill to other entities.

**Parameters:**

| Name                    | Type      | Required | Description                          |
| ----------------------- | --------- | -------- | ------------------------------------ |
| `skillName`             | string    | ✓        | Source skill                         |
| `linkSkills`            | array     |          | Skills to link                       |
| `linkSkills[].name`     | string    | ✓        | Target skill name                    |
| `linkSkills[].relation` | enum      | ✓        | `prerequisite`, `related`, `extends` |
| `linkResources`         | integer[] |          | Resource IDs to link                 |
| `linkFacts`             | integer[] |          | Fact IDs to link                     |

## Execution Logs

Persistent records of commands, tests, builds, and other actions. Enables institutional memory for what works.

### `submit_execution_logs`

Submit one or more execution logs.

**Parameters:**

| Name                      | Type      | Required | Description                                           |
| ------------------------- | --------- | -------- | ----------------------------------------------------- |
| `logs`                    | array     | ✓        | Array of execution log objects                        |
| `logs[].command`          | string    | ✓        | The command or action that was executed               |
| `logs[].success`          | boolean   | ✓        | Whether the execution succeeded                       |
| `logs[].workingDirectory` | string    |          | Working directory where command was run               |
| `logs[].context`          | string    |          | What was being attempted (free text for searchability)|
| `logs[].output`           | string    |          | The output (stdout/stderr) from the execution         |
| `logs[].exitCode`         | integer   |          | Exit code from the command                            |
| `logs[].durationMs`       | integer   |          | How long the execution took in milliseconds           |
| `logs[].skillName`        | string    |          | The skill this execution relates to                   |
| `logs[].tags`             | string[]  |          | Tags for categorization                               |

**Example:**

```json
{
  "logs": [{
    "command": "bun test",
    "workingDirectory": "./",
    "context": "Verified test command works",
    "output": "✓ 42 tests passed",
    "exitCode": 0,
    "success": true,
    "durationMs": 3500,
    "skillName": "run-tests",
    "tags": ["testing"]
  }]
}
```

**Returns:**

```json
{
  "created": 1,
  "ids": [42]
}
```

### `search_execution_logs`

Search execution logs by tags, query, success status, or skill name.

**Parameters:**

| Name        | Type     | Required | Default  | Description                                     |
| ----------- | -------- | -------- | -------- | ----------------------------------------------- |
| `tags`      | string[] |          |          | Filter by tags                                  |
| `query`     | string   |          |          | Free text search in command, context, output    |
| `success`   | boolean  |          |          | Filter by success status                        |
| `skillName` | string   |          |          | Filter by related skill name                    |
| `limit`     | integer  |          | 50       | Maximum results                                 |
| `cursor`    | string   |          |          | Pagination cursor                               |
| `orderBy`   | enum     |          | "recent" | Sort order: "recent", "oldest"                  |

**Example:**

```json
// Find successful database commands
{ "query": "drizzle", "success": true, "tags": ["database"] }

// Check validation history for a skill
{ "skillName": "run-tests", "success": true }
```

### `get_execution_log`

Get a specific execution log by ID.

**Parameters:**

| Name | Type    | Required | Description           |
| ---- | ------- | -------- | --------------------- |
| `id` | integer | ✓        | Execution log ID      |

**Returns:**

```json
{
  "id": 42,
  "command": "bun test",
  "workingDirectory": "./",
  "context": "Running unit tests",
  "output": "✓ 42 tests passed",
  "exitCode": 0,
  "success": true,
  "durationMs": 3500,
  "skillName": "run-tests",
  "tags": ["testing"],
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Maintenance

### `check_stale`

Check for stale content needing attention.

**Parameters:**

| Name             | Type    | Required | Default | Description                                               |
| ---------------- | ------- | -------- | ------- | --------------------------------------------------------- |
| `checkResources` | boolean |          | true    | Check resources                                           |
| `checkSkills`    | boolean |          | true    | Check skills                                              |
| `checkFacts`     | boolean |          | true    | Check facts                                               |
| `maxAgeHours`    | integer |          | 168     | Hours before content is considered stale (default: 7 days)|

**Returns:**

- `staleResources`: Resources not verified recently (includes hours stale, retrieval methods)
- `staleSkills`: Skills with stale dependencies
- `unverifiedFacts`: Old unverified facts
- `summary`: Counts by category

### `mark_resources_refreshed`

Mark resources as verified after refreshing.

**Parameters:**

| Name          | Type      | Required | Description                    |
| ------------- | --------- | -------- | ------------------------------ |
| `resourceIds` | integer[] | ✓        | Resource IDs to mark refreshed |

## Prompts

Prompts provide pre-built context assembly for common tasks. All prompts are also available as tools with the same functionality but structured JSON output.

### `knowledge_context`

Build knowledge context from tags. Assembles relevant facts, resources, and skills into formatted text.

**Arguments:**

| Name                       | Type   | Required | Default | Description                          |
| -------------------------- | ------ | -------- | ------- | ------------------------------------ |
| `tags`                     | string | ✓        |         | JSON array of tags (e.g., `["api"]`) |
| `maxFacts`                 | string |          | "50"    | Maximum facts                        |
| `maxResources`             | string |          | "20"    | Maximum resources                    |
| `maxSkills`                | string |          | "10"    | Maximum skills                       |
| `includeStalenessWarnings` | string |          | "true"  | Include staleness warnings section   |

**Tool equivalent:** `get_knowledge_context` (takes array for `tags` instead of JSON string)

**Example:**

```
Use knowledge_context with tags='["api","auth"]' to get context for working on authentication.
```

**Output includes:**

- Known Facts (verified/unverified)
- Relevant Resources (with snapshot preview)
- Available Skills (with stale dependency warnings)
- Staleness Warnings section (when enabled)

### `recall_skill`

Recall a skill with full content and references.

**Arguments:**

| Name          | Type   | Required | Default | Description                      |
| ------------- | ------ | -------- | ------- | -------------------------------- |
| `name`        | string | ✓        |         | Skill name                       |
| `includeRefs` | string |          | "false" | Include referenced skill content |

**Tool equivalent:** `build_skill_context` (takes boolean for `includeRefs`)

### `maintenance_report`

Generate a maintenance report.

**Arguments:**

| Name          | Type   | Required | Default | Description               |
| ------------- | ------ | -------- | ------- | ------------------------- |
| `maxAgeHours` | string |          | "168"   | Stale threshold in hours  |

**Tool equivalent:** `get_maintenance_report` (takes number for `maxAgeHours`)

**Returns:** Formatted report with:

- Stale resources with retrieval methods
- Skills with stale dependencies
- Old unverified facts
- Actionable recommendations

### `refresh_guide`

Get step-by-step instructions for refreshing a resource.

**Arguments:**

| Name         | Type   | Required | Description            |
| ------------ | ------ | -------- | ---------------------- |
| `resourceId` | string | ✓        | Resource ID to refresh |

**Tool equivalent:** `get_refresh_guide` (takes number for `resourceId`)

## Prompt Tools

These tools provide the same functionality as prompts but with:
- Proper typed inputs (arrays, numbers, booleans instead of strings)
- Structured JSON output including both markdown and metadata
- Better programmatic integration for agents

| Tool                     | Prompt Equivalent    | Key Differences                                          |
| ------------------------ | -------------------- | -------------------------------------------------------- |
| `get_knowledge_context`  | `knowledge_context`  | `tags` as array, returns `{ markdown, data }`            |
| `build_skill_context`    | `recall_skill`       | `includeRefs` as boolean, returns `{ markdown, found }`  |
| `get_maintenance_report` | `maintenance_report` | `maxAgeHours` as number, returns `{ markdown, summary }` |
| `get_refresh_guide`      | `refresh_guide`      | `resourceId` as number, returns `{ markdown, found }`    |

## Static Guide Tools

These tools provide access to built-in documentation and guides:

| Tool                    | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `get_agent_guide`       | **Call first!** Returns the agent workflow guide with phases, best practices, and tool reference |
| `get_factsets_concept`  | Returns the conceptual overview explaining design philosophy, core concepts, and data model |

**Usage:** Agents should call `get_agent_guide` when first interacting with Factsets to understand the workflow.

## Client Directory Mapping

Skills are saved as markdown files. The directory varies by client:

| Client           | Skills Directory            |
| ---------------- | --------------------------- |
| `github-copilot` | `.github/prompts/skills/`   |
| `cursor`         | `.cursor/prompts/skills/`   |
| `windsurf`       | `.windsurf/skills/`         |
| `claude-desktop` | `.claude/skills/`           |
| Custom           | Set via `skills_dir` config |

## Typical Workflows

### First Time Setup

1. Call `get_agent_guide` to understand the workflow
2. Call `get_factsets_concept` for design philosophy (optional)

### Building Context for a Task

1. Use `get_knowledge_context` tool with relevant tags (preferred)
2. Or use `knowledge_context` prompt with JSON-stringified tags
3. Or manually: `search_facts`, `search_resources`, `search_skills` with tags

### Adding Knowledge

1. `create_tags` for new categories
2. `submit_facts` for atomic knowledge
3. `add_resources` for external references
4. `create_skill` for procedural knowledge (link `executionLogId` for command-based skills!)

### Recording Command History

1. Run a command successfully
2. `submit_execution_logs` to record what worked
3. `create_skill` or `update_skill` with `executionLogId` to link the validation
4. Later: `search_execution_logs` to find what worked before

### Re-validating Skills

1. `get_skill` to retrieve skill with `executionLogId`
2. `get_execution_log` to get the original command
3. Re-run the command to verify it still works
4. `submit_execution_logs` with fresh results
5. `update_skill` to link the new execution log

### Maintaining Knowledge

1. `get_maintenance_report` to identify items needing attention (structured output)
2. Or use `check_stale` to find outdated content (raw data)
3. Use `get_refresh_guide` for resource refresh instructions
4. Fetch fresh content and call `update_resource_snapshot`
5. `mark_resources_refreshed` after verification
6. `verify_facts` to confirm accuracy
7. `delete_facts` to clean up obsolete facts

### Linking Knowledge

1. `link_skill` to connect skills to facts, resources, and other skills
2. Use `hydrateRefs: true` in `get_skill` to retrieve linked content
3. Use `build_skill_context` with `includeRefs: true` for formatted output with hydrated references
