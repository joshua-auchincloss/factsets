# Factsets MCP Server Reference

A self-maintaining knowledge base exposed via the Model Context Protocol (MCP). Stores facts, resources, and skills in SQLite for agent context persistence.

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

### set_config

Set a configuration value.

| Name    | Type   | Required | Description         |
| ------- | ------ | -------- | ------------------- |
| `key`   | string | yes      | Configuration key   |
| `value` | string | yes      | Configuration value |

Common keys:

| Key          | Values                                                   | Description                               |
| ------------ | -------------------------------------------------------- | ----------------------------------------- |
| `client`     | `github-copilot`, `cursor`, `windsurf`, `claude-desktop` | Client type (determines skills directory) |
| `skills_dir` | path                                                     | Override default skills directory         |

Example:

```json
{ "key": "client", "value": "github-copilot" }
```

### get_config

Get a configuration value.

| Name  | Type   | Required | Description       |
| ----- | ------ | -------- | ----------------- |
| `key` | string | yes      | Configuration key |

### get_config_schema

Get the full configuration schema showing all available options with their types, defaults, and descriptions.

No parameters.

Returns schema with all configurable keys including:

- Freshness thresholds per resource category
- Search limits for all entity types
- Context budgets for knowledge context
- Tag relationship settings
- Snapshot management options
- Maintenance and worker intervals

### delete_config

Delete a configuration value.

| Name  | Type   | Required | Description       |
| ----- | ------ | -------- | ----------------- |
| `key` | string | yes      | Configuration key |

### list_config

List all configuration values.

No parameters.

### Configuration Categories

#### Freshness Thresholds

Control how long before resources are considered stale:

| Key                         | Default | Description                                |
| --------------------------- | ------- | ------------------------------------------ |
| `freshness_source_code`     | 12      | Source code files (.ts, .js, .py, etc.)    |
| `freshness_lock_files`      | 168     | Lock files (package-lock.json, etc.)       |
| `freshness_config_files`    | 24      | Config files (tsconfig.json, etc.)         |
| `freshness_documentation`   | 72      | Documentation (.md, /docs/)                |
| `freshness_generated_files` | 1       | Generated files (/dist/, .min.js)          |
| `freshness_api_schemas`     | 24      | API schemas (.graphql, .proto)             |
| `freshness_database`        | 72      | Database files (.sql, /migrations/)        |
| `freshness_scripts`         | 72      | Scripts (.sh, Makefiles)                   |
| `freshness_tests`           | 24      | Test files (.test.ts, /__tests__/)         |
| `freshness_assets`          | 168     | Assets (images, fonts, media)              |
| `freshness_infrastructure`  | 24      | Infrastructure (Terraform, Docker, K8s)    |
| `freshness_default`         | 168     | Default for unmatched files                |

#### Search Limits

Control maximum results for search operations:

| Key                           | Default | Description                     |
| ----------------------------- | ------- | ------------------------------- |
| `search_limit_tags`           | 100     | Maximum tags returned           |
| `search_limit_facts`          | 50      | Maximum facts returned          |
| `search_limit_resources`      | 100     | Maximum resources returned      |
| `search_limit_skills`         | 30      | Maximum skills returned         |
| `search_limit_execution_logs` | 50      | Maximum execution logs returned |
| `search_include_deleted`      | false   | Include soft-deleted items      |

#### Context Budgets

Control `get_knowledge_context` output size:

| Key                      | Default | Description                       |
| ------------------------ | ------- | --------------------------------- |
| `context_budget_facts`   | 50      | Max facts in knowledge context    |
| `context_budget_resources` | 20    | Max resources in knowledge context|
| `context_budget_skills`  | 10      | Max skills in knowledge context   |

#### Tag Relationships

Configure tag expansion for searches:

| Key               | Type | Default | Description                            |
| ----------------- | ---- | ------- | -------------------------------------- |
| `tag_synonyms`    | JSON | `{}`    | Equivalent tags (e.g., `{"js": "javascript"}`) |
| `tag_hierarchies` | JSON | `{}`    | Parent-child tags (e.g., `{"backend": ["python", "go"]}`) |
| `required_tags`   | JSON | `{}`    | Required tags per entity type          |

#### Snapshot Management

Control resource snapshot storage:

| Key                           | Default    | Description                              |
| ----------------------------- | ---------- | ---------------------------------------- |
| `snapshot_max_size_kb`        | 100        | Max snapshot size in KB                  |
| `snapshot_overflow_behavior`  | `truncate` | `truncate`, `summarize`, `remove_noise`, `auto` |
| `snapshot_retention_versions` | 3          | Number of snapshot versions to retain    |

#### Maintenance Settings

| Key                           | Default | Description                           |
| ----------------------------- | ------- | ------------------------------------- |
| `auto_prune_orphan_tags`      | false   | Auto-prune unused tags                |
| `soft_delete_retention_days`  | 7       | Days before hard delete               |
| `staleness_warning_threshold` | 0.8     | Fraction of max age for early warning |

#### Background Worker Intervals

All values in milliseconds:

| Key                               | Default  | Description                     |
| --------------------------------- | -------- | ------------------------------- |
| `worker_interval_auto_verify`     | 3600000  | Auto-verify old facts (1h)      |
| `worker_interval_expire_facts`    | 7200000  | Expire unverified facts (2h)    |
| `worker_interval_prune_snapshots` | 86400000 | Prune old snapshots (24h)       |
| `worker_interval_prune_tags`      | 86400000 | Prune orphan tags (24h)         |
| `worker_interval_hard_delete`     | 86400000 | Hard-delete expired items (24h) |

## Tags

Tags organize facts, resources, and skills. Create tags first, then use them when submitting content.

### create_tags

Create one or more tags.

| Name                 | Type   | Required | Description          |
| -------------------- | ------ | -------- | -------------------- |
| `tags`               | array  | yes      | Array of tag objects |
| `tags[].name`        | string | yes      | Tag name             |
| `tags[].description` | string | no       | Optional description |

Example:

```json
{
  "tags": [
    { "name": "database", "description": "Database-related knowledge" },
    { "name": "api" }
  ]
}
```

### list_tags

List tags with optional filtering.

| Name      | Type    | Required | Default | Description                           |
| --------- | ------- | -------- | ------- | ------------------------------------- |
| `filter`  | string  | no       | -       | Filter by name pattern                |
| `limit`   | integer | no       | 100     | Maximum results                       |
| `orderBy` | enum    | no       | "usage" | Sort order: "usage", "name", "recent" |

### prune_orphan_tags

Clean up orphan tags that have zero usage across all entity types (facts, resources, skills, execution logs).

| Name     | Type    | Required | Default | Description                                          |
| -------- | ------- | -------- | ------- | ---------------------------------------------------- |
| `dryRun` | boolean | no       | false   | If true, return list of orphan tags without deleting |

Example (dry run):

```json
{ "dryRun": true }
```

Returns:

```json
{
  "pruned": 3,
  "orphanTags": [
    { "id": 1, "name": "unused-tag" },
    { "id": 5, "name": "stale-tag" },
    { "id": 8, "name": "old-tag" }
  ]
}
```

Example (actual deletion):

```json
{}
```

Returns:

```json
{ "pruned": 3 }
```

## Facts

Atomic knowledge units (1-3 sentences). Facts are upserted - matching content updates instead of duplicating.

### submit_facts

Submit one or more facts.

| Name                 | Type     | Required | Description                                  |
| -------------------- | -------- | -------- | -------------------------------------------- |
| `facts`              | array    | yes      | Array of fact objects                        |
| `facts[].content`    | string   | yes      | The fact itself                              |
| `facts[].tags`       | string[] | yes      | Tags for categorization                      |
| `facts[].source`     | string   | no       | Where the fact came from                     |
| `facts[].sourceType` | enum     | no       | `user`, `documentation`, `code`, `inference` |
| `facts[].verified`   | boolean  | no       | Default: `false`                             |

Example:

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

### search_facts

Search facts by tags, query, or filters.

| Name           | Type     | Required | Default  | Description                             |
| -------------- | -------- | -------- | -------- | --------------------------------------- |
| `tags`         | string[] | no       | -        | Filter by tags                          |
| `query`        | string   | no       | -        | Text search in content                  |
| `limit`        | integer  | no       | 50       | Maximum results                         |
| `orderBy`      | enum     | no       | "recent" | Sort order: "recent", "oldest", "usage" |
| `verifiedOnly` | boolean  | no       | -        | Only verified facts                     |
| `sourceType`   | enum     | no       | -        | Filter by source type                   |

### verify_facts

Mark facts as verified.

| Name  | Type      | Required | Description        |
| ----- | --------- | -------- | ------------------ |
| `ids` | integer[] | yes      | Fact IDs to verify |

### delete_facts

Delete facts by various criteria.

| Name             | Type      | Required | Description                  |
| ---------------- | --------- | -------- | ---------------------------- |
| `ids`            | integer[] | no       | Specific fact IDs            |
| `tags`           | string[]  | no       | Delete facts with these tags |
| `olderThan`      | datetime  | no       | Delete facts older than this |
| `unverifiedOnly` | boolean   | no       | Only delete unverified facts |

### update_fact

Update an existing fact's content, metadata, or tags.

| Name                 | Type     | Required | Description                               |
| -------------------- | -------- | -------- | ----------------------------------------- |
| `id`                 | integer  | \*       | Fact ID to update                         |
| `contentMatch`       | string   | \*       | Match fact by exact content instead of ID |
| `updates`            | object   | yes      | Fields to update                          |
| `updates.content`    | string   | no       | New content                               |
| `updates.source`     | string   | no       | New source                                |
| `updates.sourceType` | enum     | no       | New source type                           |
| `updates.verified`   | boolean  | no       | Set verification status                   |
| `updates.tags`       | string[] | no       | Replace all tags                          |
| `updates.appendTags` | string[] | no       | Add tags without removing existing        |
| `updates.removeTags` | string[] | no       | Remove specific tags                      |

\*One of `id` or `contentMatch` is required.

Example:

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

### verify_facts_by_tags

Bulk verify all facts matching specified tags.

| Name         | Type     | Required | Default | Description                                        |
| ------------ | -------- | -------- | ------- | -------------------------------------------------- |
| `tags`       | string[] | yes      | -       | Tags to match                                      |
| `requireAll` | boolean  | no       | false   | If true, only verify facts with all specified tags |

Example:

```json
{ "tags": ["api", "auth"] }
```

Returns:

```json
{
  "verified": 5,
  "factIds": [1, 2, 3, 4, 5]
}
```

### restore_facts

Restore soft-deleted facts.

| Name  | Type      | Required | Description                          |
| ----- | --------- | -------- | ------------------------------------ |
| `ids` | integer[] | yes      | IDs of soft-deleted facts to restore |

Returns:

```json
{ "restored": 3 }
```

## Resources

External content references with cached snapshots. The system stores retrieval methods - actual fetching is performed by the agent.

### add_resources

Register resources with retrieval methods.

| Name                          | Type     | Required | Description                     |
| ----------------------------- | -------- | -------- | ------------------------------- |
| `resources`                   | array    | yes      | Array of resource objects       |
| `resources[].uri`             | string   | yes      | Location (path, URL, etc.)      |
| `resources[].type`            | enum     | yes      | `file`, `url`, `api`, `command` |
| `resources[].tags`            | string[] | yes      | Tags for categorization         |
| `resources[].snapshot`        | string   | no       | Initial cached content          |
| `resources[].retrievalMethod` | object   | no       | How to refresh                  |

Retrieval method:

| Name      | Type   | Description                            |
| --------- | ------ | -------------------------------------- |
| `type`    | string | Method type                            |
| `command` | string | Shell command (for file/command types) |
| `url`     | string | URL to fetch (for url/api types)       |
| `headers` | object | HTTP headers                           |

Example:

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

### search_resources

Search resources by tags, type, or URI pattern.

| Name         | Type     | Required | Default  | Description                             |
| ------------ | -------- | -------- | -------- | --------------------------------------- |
| `tags`       | string[] | no       | -        | Filter by tags                          |
| `type`       | enum     | no       | -        | `file`, `url`, `api`, `command`         |
| `uriPattern` | string   | no       | -        | URI pattern to match                    |
| `limit`      | integer  | no       | 100      | Maximum results                         |
| `orderBy`    | enum     | no       | "recent" | Sort order: "recent", "oldest", "fresh" |

### get_resources

Get one or more resources with their snapshots.

| Name          | Type      | Required | Default | Description                              |
| ------------- | --------- | -------- | ------- | ---------------------------------------- |
| `ids`         | integer[] | \*       | -       | Resource IDs                             |
| `uris`        | string[]  | \*       | -       | Resource URIs                            |
| `maxAgeHours` | integer   | no       | 1       | Hours before content is considered stale |

\*Either `ids` or `uris` is required.

Returns array of resources with:

- `uri`: Resource location
- `type`: Resource type
- `content`: Cached snapshot
- `isFresh`: Whether snapshot is within freshnessThresholdHours
- `snapshotAgeSeconds`: Age of snapshot
- `retrievalMethod`: How to refresh
- `categories`: Inferred freshness categories
- `freshnessThresholdHours`: Applied threshold

### update_resource_snapshot

Update cached content after fetching fresh data.

| Name       | Type    | Required | Description        |
| ---------- | ------- | -------- | ------------------ |
| `id`       | integer | \*       | Resource ID        |
| `uri`      | string  | \*       | Resource URI       |
| `snapshot` | string  | yes      | New cached content |

\*One of `id` or `uri` is required.

### update_resource_snapshots

Bulk update cached content for multiple resources.

| Name                     | Type    | Required | Description               |
| ------------------------ | ------- | -------- | ------------------------- |
| `snapshots`              | array   | yes      | Array of snapshot updates |
| `snapshots[].resourceId` | integer | yes      | Resource ID               |
| `snapshots[].snapshot`   | string  | yes      | New cached content        |

Example:

```json
{
  "snapshots": [
    { "resourceId": 1, "snapshot": "updated content 1" },
    { "resourceId": 2, "snapshot": "updated content 2" }
  ]
}
```

### update_resource

Update resource metadata (description, tags, retrieval method) without modifying snapshot content or lastVerifiedAt timestamp. Use this to fix placeholder descriptions or reorganize tags.

| Name              | Type     | Required    | Description                                |
| ----------------- | -------- | ----------- | ------------------------------------------ |
| `id`              | integer  | conditional | Resource ID (required if uri not provided) |
| `uri`             | string   | conditional | Resource URI (required if id not provided) |
| `description`     | string   | no          | New description for the resource           |
| `tags`            | string[] | no          | Replace all tags with this list            |
| `appendTags`      | string[] | no          | Add tags without removing existing ones    |
| `retrievalMethod` | object   | no          | Update the retrieval method                |

At least one of `description`, `tags`, `appendTags`, or `retrievalMethod` must be provided.

Example:

```json
{
  "id": 42,
  "description": "TypeScript compiler configuration with strict mode and ES2022 target",
  "appendTags": ["reviewed"]
}
```

### delete_resources

Delete resources by ID or URI. Either `ids` or `uris` must be provided (or both).

| Name   | Type      | Required    | Description                                                 |
| ------ | --------- | ----------- | ----------------------------------------------------------- |
| `ids`  | integer[] | conditional | Resource IDs to delete (required if `uris` not provided)    |
| `uris` | string[]  | conditional | Resource URIs to delete (required if `ids` not provided)    |
| `soft` | boolean   | no          | If true, soft delete (set deletedAt) instead of hard delete |

Returns:

```json
{
  "deleted": 3
}
```

### restore_resources

Restore soft-deleted resources.

| Name  | Type      | Required | Description                              |
| ----- | --------- | -------- | ---------------------------------------- |
| `ids` | integer[] | yes      | IDs of soft-deleted resources to restore |

Returns:

```json
{ "restored": 2 }
```

## Skills

Markdown documents capturing procedural knowledge. Skills can reference other skills, resources, and facts.

### create_skill

Create a skill document.

| Name                   | Type      | Required | Description                                             |
| ---------------------- | --------- | -------- | ------------------------------------------------------- |
| `name`                 | string    | yes      | Unique identifier (lowercase, alphanumeric with dashes) |
| `title`                | string    | yes      | Human-readable title                                    |
| `description`          | string    | no       | Brief description                                       |
| `content`              | string    | yes      | Markdown content                                        |
| `tags`                 | string[]  | yes      | Tags for categorization                                 |
| `references`           | object    | no       | Initial references                                      |
| `references.skills`    | string[]  | no       | Names of related skills                                 |
| `references.resources` | integer[] | no       | Resource IDs                                            |
| `references.facts`     | integer[] | no       | Fact IDs                                                |
| `executionLogId`       | integer   | no       | ID of execution log that validated this skill           |

Example:

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

### update_skill

Update a skill's metadata, tags, or references. Does not modify file content - use `sync_skill` after editing the file directly.

| Name             | Type     | Required | Description                                   |
| ---------------- | -------- | -------- | --------------------------------------------- |
| `name`           | string   | yes      | Skill name                                    |
| `title`          | string   | no       | New title                                     |
| `description`    | string   | no       | New description                               |
| `tags`           | string[] | no       | Replace all tags                              |
| `appendTags`     | string[] | no       | Add tags (keeps existing)                     |
| `references`     | object   | no       | Modify references                             |
| `executionLogId` | integer  | no       | ID of execution log that validated this skill |

Reference updates:

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

### sync_skill

Sync a skill's content hash after the file has been modified externally. Call this after editing the skill file directly.

| Name   | Type   | Required | Description |
| ------ | ------ | -------- | ----------- |
| `name` | string | yes      | Skill name  |

Returns:

```json
{
  "name": "my-skill",
  "contentHash": "abc123...",
  "updated": true
}
```

### delete_skills

Delete skills by name. Optionally delete the skill files from disk.

| Name          | Type     | Required | Default | Description                  |
| ------------- | -------- | -------- | ------- | ---------------------------- |
| `names`       | string[] | yes      | -       | Skill names to delete        |
| `deleteFiles` | boolean  | no       | false   | Delete skill files from disk |

Returns:

```json
{
  "deleted": 2,
  "filesDeleted": 2
}
```

### search_skills

Search skills by tags or title.

| Name      | Type     | Required | Default  | Description                            |
| --------- | -------- | -------- | -------- | -------------------------------------- |
| `tags`    | string[] | no       | -        | Filter by tags                         |
| `query`   | string   | no       | -        | Search title                           |
| `limit`   | integer  | no       | 30       | Maximum results                        |
| `orderBy` | enum     | no       | "recent" | Sort order: "recent", "oldest", "name" |

Returns: Skills with `hasStaleDeps` flag indicating stale dependencies.

### get_skills

Retrieve one or more skills with full content.

| Name          | Type     | Required | Default | Description                      |
| ------------- | -------- | -------- | ------- | -------------------------------- |
| `names`       | string[] | yes      | -       | Skill names to retrieve          |
| `hydrateRefs` | boolean  | no       | false   | Include referenced skill content |

Returns:

```json
{
  "skills": [{ "name": "...", "title": "...", "content": "...", "tags": [...], "references": {...} }],
  "notFound": ["missing-skill"]
}
```

### link_skill

Add references from a skill to other entities.

| Name                    | Type      | Required | Description                          |
| ----------------------- | --------- | -------- | ------------------------------------ |
| `skillName`             | string    | yes      | Source skill                         |
| `linkSkills`            | array     | no       | Skills to link                       |
| `linkSkills[].name`     | string    | yes      | Target skill name                    |
| `linkSkills[].relation` | enum      | yes      | `prerequisite`, `related`, `extends` |
| `linkResources`         | integer[] | no       | Resource IDs to link                 |
| `linkFacts`             | integer[] | no       | Fact IDs to link                     |

### get_dependency_graph

Get a dependency graph for a skill showing all connected skills, resources, and facts.

| Name             | Type    | Required | Default | Description                  |
| ---------------- | ------- | -------- | ------- | ---------------------------- |
| `skillName`      | string  | yes      | -       | Skill name to graph          |
| `maxDepth`       | integer | no       | 3       | Maximum depth to traverse    |
| `includeContent` | boolean | no       | false   | Include content of each node |

Returns:

```json
{
  "root": {
    "name": "deploy-guide",
    "title": "Deploy Guide",
    "tags": ["devops"]
  },
  "nodes": [
    {
      "type": "skill",
      "id": "docker-basics",
      "name": "docker-basics",
      "depth": 1
    },
    {
      "type": "resource",
      "id": 5,
      "name": "Dockerfile",
      "isStale": false,
      "depth": 1
    }
  ],
  "edges": [
    {
      "from": "deploy-guide",
      "to": "docker-basics",
      "relation": "prerequisite"
    },
    { "from": "deploy-guide", "to": "5", "relation": "resource" }
  ],
  "summary": {
    "totalSkills": 2,
    "totalResources": 1,
    "totalFacts": 0,
    "staleCount": 0,
    "maxDepthReached": 1
  }
}
```

### restore_skills

Restore soft-deleted skills.

| Name    | Type     | Required | Description                             |
| ------- | -------- | -------- | --------------------------------------- |
| `names` | string[] | yes      | Names of soft-deleted skills to restore |

Returns:

```json
{ "restored": 2 }
```

## Execution Logs

Persistent records of commands, tests, builds, and other actions. Enables institutional memory for what works.

### submit_execution_logs

Submit one or more execution logs.

| Name                      | Type     | Required | Description                                            |
| ------------------------- | -------- | -------- | ------------------------------------------------------ |
| `logs`                    | array    | yes      | Array of execution log objects                         |
| `logs[].command`          | string   | yes      | The command or action that was executed                |
| `logs[].success`          | boolean  | yes      | Whether the execution succeeded                        |
| `logs[].workingDirectory` | string   | no       | Working directory where command was run                |
| `logs[].context`          | string   | no       | What was being attempted (free text for searchability) |
| `logs[].output`           | string   | no       | The output (stdout/stderr) from the execution          |
| `logs[].exitCode`         | integer  | no       | Exit code from the command                             |
| `logs[].durationMs`       | integer  | no       | How long the execution took in milliseconds            |
| `logs[].skillName`        | string   | no       | The skill this execution relates to                    |
| `logs[].tags`             | string[] | no       | Tags for categorization                                |

Example:

```json
{
  "logs": [
    {
      "command": "bun test",
      "workingDirectory": "./",
      "context": "Verified test command works",
      "output": "42 tests passed",
      "exitCode": 0,
      "success": true,
      "durationMs": 3500,
      "skillName": "run-tests",
      "tags": ["testing"]
    }
  ]
}
```

Returns:

```json
{
  "created": 1,
  "ids": [42]
}
```

### search_execution_logs

Search execution logs by tags, query, success status, or skill name.

| Name        | Type     | Required | Default  | Description                                  |
| ----------- | -------- | -------- | -------- | -------------------------------------------- |
| `tags`      | string[] | no       | -        | Filter by tags                               |
| `query`     | string   | no       | -        | Free text search in command, context, output |
| `success`   | boolean  | no       | -        | Filter by success status                     |
| `skillName` | string   | no       | -        | Filter by related skill name                 |
| `limit`     | integer  | no       | 50       | Maximum results                              |
| `cursor`    | string   | no       | -        | Pagination cursor                            |
| `orderBy`   | enum     | no       | "recent" | Sort order: "recent", "oldest"               |

Example:

```json
{ "query": "drizzle", "success": true, "tags": ["database"] }
```

### get_execution_log

Get a specific execution log by ID.

| Name | Type    | Required | Description      |
| ---- | ------- | -------- | ---------------- |
| `id` | integer | yes      | Execution log ID |

Returns:

```json
{
  "id": 42,
  "command": "bun test",
  "workingDirectory": "./",
  "context": "Running unit tests",
  "output": "42 tests passed",
  "exitCode": 0,
  "success": true,
  "durationMs": 3500,
  "skillName": "run-tests",
  "tags": ["testing"],
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Maintenance

### check_stale

Check for stale content needing attention.

| Name             | Type    | Required | Default | Description                                                |
| ---------------- | ------- | -------- | ------- | ---------------------------------------------------------- |
| `checkResources` | boolean | no       | true    | Check resources                                            |
| `checkSkills`    | boolean | no       | true    | Check skills                                               |
| `checkFacts`     | boolean | no       | true    | Check facts                                                |
| `maxAgeHours`    | integer | no       | 168     | Hours before content is considered stale (default: 7 days) |

Returns:

- `staleResources`: Resources past the staleness threshold (includes hours stale, retrieval methods)
- `approachingStaleResources`: Resources past the warning threshold but not yet stale (configurable via `staleness_warning_threshold`)
- `staleSkills`: Skills with stale dependencies
- `unverifiedFacts`: Old unverified facts
- `skillsNeedingReview`: Skills flagged for review
- `incompleteDescriptions`: Items with placeholder descriptions
- `summary`: Counts by category including `approachingStaleResources`

### mark_resources_refreshed

Mark resources as verified after refreshing.

| Name          | Type      | Required | Description                    |
| ------------- | --------- | -------- | ------------------------------ |
| `resourceIds` | integer[] | yes      | Resource IDs to mark refreshed |

### Background Worker

The background worker performs periodic maintenance. Run separately:

```bash
bunx factsets worker --database-url .facts.db
```

Worker tasks (intervals configurable via `worker_interval_*` keys):

| Task         | Default Interval | Description                              |
| ------------ | ---------------- | ---------------------------------------- |
| Auto-verify  | 1 hour           | Mark old unverified facts as verified    |
| Expire facts | 2 hours          | Soft-delete unverified facts > 30 days   |
| Prune tags   | 24 hours         | Remove unused tags (if enabled)          |
| Hard delete  | 24 hours         | Permanently remove expired soft-deletes  |

Worker state persists in the database and survives restarts.

## Prompts

Prompts provide pre-built context assembly for common tasks. All prompts are also available as tools with the same functionality but structured JSON output.

### knowledge_context

Build knowledge context from tags. Assembles relevant facts, resources, and skills into formatted text.

| Name                       | Type   | Required | Default | Description                          |
| -------------------------- | ------ | -------- | ------- | ------------------------------------ |
| `tags`                     | string | yes      | -       | JSON array of tags (e.g., `["api"]`) |
| `maxFacts`                 | string | no       | "50"    | Maximum facts                        |
| `maxResources`             | string | no       | "20"    | Maximum resources                    |
| `maxSkills`                | string | no       | "10"    | Maximum skills                       |
| `includeStalenessWarnings` | string | no       | "true"  | Include staleness warnings section   |

Tool equivalent: `get_knowledge_context` (takes array for `tags` instead of JSON string)

Output includes:

- Known Facts (verified/unverified)
- Relevant Resources (with snapshot preview)
- Available Skills (with stale dependency warnings)
- Staleness Warnings section (when enabled)

### recall_skill

Recall a skill with full content and references.

| Name          | Type   | Required | Default | Description                      |
| ------------- | ------ | -------- | ------- | -------------------------------- |
| `name`        | string | yes      | -       | Skill name                       |
| `includeRefs` | string | no       | "false" | Include referenced skill content |

Tool equivalent: `build_skill_context` (takes boolean for `includeRefs`)

### maintenance_report

Generate a maintenance report.

| Name          | Type   | Required | Default | Description              |
| ------------- | ------ | -------- | ------- | ------------------------ |
| `maxAgeHours` | string | no       | "168"   | Stale threshold in hours |

Tool equivalent: `get_maintenance_report` (takes number for `maxAgeHours`)

Returns formatted report with:

- Stale resources with retrieval methods
- Skills with stale dependencies
- Old unverified facts
- Actionable recommendations

### refresh_guide

Get step-by-step instructions for refreshing a resource.

| Name         | Type   | Required | Description            |
| ------------ | ------ | -------- | ---------------------- |
| `resourceId` | string | yes      | Resource ID to refresh |

Tool equivalent: `get_refresh_guide` (takes number for `resourceId`)

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

| Tool                   | Description                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `get_agent_guide`      | Call first. Returns the agent workflow guide with phases, best practices, and tool reference |
| `get_concept_guide` | Returns the conceptual overview explaining design philosophy, core concepts, and data model  |

Usage: Agents should call `get_agent_guide` when first interacting with Factsets to understand the workflow.

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
2. Call `get_concept_guide` for design philosophy (optional)

### Building Context for a Task

1. Use `get_knowledge_context` tool with relevant tags (preferred)
2. Or use `knowledge_context` prompt with JSON-stringified tags
3. Or manually: `search_facts`, `search_resources`, `search_skills` with tags

### Adding Knowledge

1. `create_tags` for new categories
2. `submit_facts` for atomic knowledge
3. `add_resources` for external references
4. `create_skill` for procedural knowledge (link `executionLogId` for command-based skills)

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
