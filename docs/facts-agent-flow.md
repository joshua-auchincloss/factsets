# Factsets Agent Workflow

Factsets is an MCP server providing persistent knowledge storage: **facts** (atomic statements), **resources** (cached
external content), **skills** (procedural markdown), and **tags** (categorization).

## Getting Started

**First time using Factsets?** Call `get_agent_guide` to get this workflow guide, or `get_factsets_concept` for the
conceptual overview explaining the design philosophy.

## Workflow Phases

1. **Discover** - `list_tags` at session start
1. **Retrieve** - `search_facts`/`search_skills` by relevant tags
1. **Execute** - Perform task
1. **Contribute** - `submit_facts`/`create_skill` from learnings
1. **Maintain** - `check_stale` periodically (not every session)

## Discovery

**Every session:** `list_tags { limit: 100, orderBy: "usage" }` returns tags sorted by most-used first.

**Task-specific:** `search_facts { tags: ["relevant-tag"], limit: 20, orderBy: "recent" }`

**Full context:** Use `get_knowledge_context` tool with `tags: ["tag1", "tag2"]` for assembled facts + resources + skills + staleness warnings. Returns structured JSON with markdown and metadata.

Alternatively, use the `knowledge_context` prompt (takes JSON string: `tags: '["tag1","tag2"]'`).

## Retrieval

### Ordering Options

Use `orderBy` to get the most relevant results first:

| Entity    | Options                     | Best For                                                     |
| --------- | --------------------------- | ------------------------------------------------------------ |
| Facts     | `recent`, `oldest`, `usage` | `usage` for established knowledge, `recent` for new projects |
| Resources | `recent`, `oldest`, `fresh` | `fresh` for active development, `recent` for new setups      |
| Skills    | `recent`, `oldest`, `name`  | `name` for browsing, `recent` for latest procedures          |
| Tags      | `usage`, `name`, `recent`   | `usage` for common domains, `name` for exploration           |

### By Tag

```json
search_facts { "tags": ["api", "auth"], "orderBy": "usage", "limit": 50 }
```

### By Query

```json
search_facts { "query": "JWT token", "orderBy": "recent" }
```

### Resources

```json
get_resource { "uri": "./config.json", "maxAgeHours": 24 }
```

If `isFresh: false`, execute `retrievalMethod` and call `update_resource_snapshot`. Use higher `maxAgeHours`
for stable configs (24h), lower for volatile files (1h).

## Contribution

### Facts

Submit when learning project conventions, user preferences, technical specifics, or gotchas.

```json
submit_facts { "facts": [{
  "content": "Project uses Drizzle ORM with SQLite",
  "tags": ["database", "orm"],
  "sourceType": "code",
  "verified": true
}]}
```

- Atomic (1-3 sentences)
- Use existing tags
- `sourceType`: `user`, `documentation`, `code`, `inference`
- `verified: true` only if confirmed

### Updating Facts

To update an existing fact's content, metadata, or tags:

```json
update_fact {
  "id": 42,
  "updates": {
    "content": "Updated content here",
    "verified": true,
    "appendTags": ["reviewed"]
  }
}
```

Find fact by ID or exact content match:

```json
update_fact {
  "contentMatch": "Original exact content",
  "updates": { "verified": true }
}
```

**Update options:**
- `content`: New content text
- `source`, `sourceType`: Update provenance
- `verified`: Set verification status
- `tags`: Replace all tags with new array
- `appendTags`: Add tags without removing existing
- `removeTags`: Remove specific tags

### Skills

Create for multi-step procedures or patterns spanning multiple facts.

````json
create_skill {
  "name": "run-tests",
  "title": "Running Tests",
  "content": "# Running Tests\n\n```bash\nbun test\n```",
  "tags": ["testing"]
}
````

Skill files are automatically synced when modified (via the file watcher). If auto-sync is disabled, manually call `sync_skill { "name": "run-tests" }` after editing. Use `update_skill` for metadata/tags/references only.

### Resources

Add for documentation URLs, config files, API schemas, frequently-read files.

```json
add_resources { "resources": [{
  "uri": "./package.json",
  "type": "file",
  "tags": ["config"],
  "snapshot": "[content]",
  "retrievalMethod": { "type": "file", "command": "cat ./package.json" }
}]}
```

## Maintenance

### Staleness Checking

Use `get_maintenance_report` tool for a comprehensive view of stale items:

```json
get_maintenance_report { "maxAgeHours": 168 }
```

Returns structured JSON with markdown report and summary counts.

The same `maxAgeHours` parameter works for fine-grained control:

```json
// For active development - check items older than 6 hours
check_stale { "maxAgeHours": 6, "checkResources": true, "checkSkills": false }

// For periodic review - check weekly (168 hours)
check_stale { "maxAgeHours": 168 }
```

**Stale resources:** Use `get_refresh_guide { resourceId: X }` for step-by-step instructions, then execute `retrievalMethod`, call `update_resource_snapshot`, and `mark_resources_refreshed`.

**Unverified facts:** Review accuracy. `verify_facts { ids: [...] }` or `delete_facts { ids: [...] }`.

For bulk verification by topic: `verify_facts_by_tags { tags: ["reviewed-topic"] }`

**Skills pending review:** These are auto-discovered skills (added via file watcher, not `create_skill`). Review their content and use `update_skill` to add tags and description - this clears the review flag.

### Automated Staleness Warnings

The `get_knowledge_context` tool automatically includes staleness warnings (disable with `includeStalenessWarnings: false`).
This provides proactive awareness without requiring explicit `check_stale` calls.

## Efficiency Tips

### Use Ordering for Relevance

- **High-activity projects:** `orderBy: "recent"` surfaces latest knowledge
- **Established projects:** `orderBy: "usage"` surfaces battle-tested knowledge
- **Browsing/learning:** `orderBy: "name"` for alphabetical exploration

### Configure Freshness Appropriately

| Resource Type   | Suggested `maxAgeHours` |
| --------------- | ----------------------------------- |
| Lock files      | 168 (1 week)                        |
| Config files    | 24                                  |
| Documentation   | 72                                  |
| Generated files | 1                                   |
| API schemas     | 24                                  |

### General Guidelines

- Use tags for filtering, set reasonable limits (defaults are generous: 50 facts, 20 resources, 10 skills)
- Batch operations (arrays in `submit_facts`, `update_resource_snapshots`)
- Use `get_knowledge_context` tool for multi-type retrieval with automatic staleness warnings
- Use `build_skill_context` to get formatted skill content with references
- Do not run `check_stale` every session - staleness warnings in context tools handle routine awareness
- Store file contents as resources, not facts

## CLI Commands

Beyond MCP, Factsets provides CLI commands:

```bash
# Start MCP server (with automatic skill file watching)
bunx factsets mcp-server --database-url ./my.db

# Start without file watching
bunx factsets mcp-server --no-watch-skills

# Run file watcher standalone
bunx factsets watch-files

# Export database to JSON (backup/migration)
bunx factsets dump backup.json

# Import database from JSON dump
bunx factsets restore backup.json
```

**Dump/Restore** are useful for:

- Backing up knowledge before major changes
- Migrating between environments
- Seeding new projects with existing knowledge

## Bootstrapping Empty Projects

1. Read package.json, README
1. `create_tags { "tags": [{ "name": "project" }, { "name": "config" }] }`
1. `submit_facts` with project name, runtime, entry point
1. `add_resources` for key config files

## Reference

| Operation            | Tool                        | Key Parameters                                                              |
| -------------------- | --------------------------- | --------------------------------------------------------------------------- |
| **Guides**           |                             |                                                                             |
| Agent workflow guide | `get_agent_guide`           | _(none)_ - **call first**                                                   |
| Concept overview     | `get_factsets_concept`      | _(none)_                                                                    |
| **Discovery**        |                             |                                                                             |
| List domains         | `list_tags`                 | `limit`, `orderBy`                                                          |
| Get context          | `get_knowledge_context`     | `tags`, `maxFacts`, `maxResources`, `maxSkills`, `includeStalenessWarnings` |
| **Facts**            |                             |                                                                             |
| Find facts           | `search_facts`              | `tags`, `query`, `limit`, `orderBy`                                         |
| Record facts         | `submit_facts`              | `facts[]`                                                                   |
| Update fact          | `update_fact`               | `id`/`contentMatch`, `updates{}`                                            |
| Verify facts         | `verify_facts`              | `ids[]`                                                                     |
| Verify by tags       | `verify_facts_by_tags`      | `tags[]`, `requireAll`                                                      |
| Delete facts         | `delete_facts`              | `ids[]`, `tags[]`, `olderThan`, `unverifiedOnly`                            |
| **Resources**        |                             |                                                                             |
| Find resources       | `search_resources`          | `tags`, `type`, `limit`, `orderBy`                                          |
| Get resource         | `get_resource`              | `uri`/`id`, `maxAgeHours`                                                   |
| Get resources (batch)| `get_resources`             | `ids[]`/`uris[]`, `maxAgeHours`                                             |
| Refresh resource     | `update_resource_snapshot`  | `uri`, `snapshot`                                                           |
| Bulk refresh         | `update_resource_snapshots` | `snapshots[]`                                                               |
| Delete resources     | `delete_resources`          | `ids`, `uris`                                                               |
| **Skills**           |                             |                                                                             |
| Find skills          | `search_skills`             | `tags`, `query`, `limit`, `orderBy`                                         |
| Get skill            | `get_skill`                 | `name`, `hydrateRefs`                                                       |
| Build skill context  | `build_skill_context`       | `name`, `includeRefs`                                                       |
| Create skill         | `create_skill`              | `name`, `title`, `content`, `tags`                                          |
| Sync skill           | `sync_skill`                | `name`                                                                      |
| Delete skills        | `delete_skills`             | `names`, `deleteFiles`                                                      |
| **Maintenance**      |                             |                                                                             |
| Check staleness      | `check_stale`               | `maxAgeHours`                                                               |
| Maintenance report   | `get_maintenance_report`    | `maxAgeHours`                                                               |
| Refresh guide        | `get_refresh_guide`         | `resourceId`                                                                |
| Mark refreshed       | `mark_resources_refreshed`  | `ids[]`                                                                     |

**Tags:** lowercase, hyphenated. Prefer existing over new. Common: `config`, `testing`, `api`, `database`, `deployment`,
`patterns`.
