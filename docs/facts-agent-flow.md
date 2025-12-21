# Factsets Agent Workflow

If information is valuable enough to tell the user, it is valuable enough to store in Factsets.

Factsets provides persistent knowledge: **facts** (atomic statements), **resources** (cached external content), **skills** (procedural markdown), **execution logs** (command history), **tags** (categorization).

## Headless Operation Philosophy

Factsets is designed for headless, continuous operation. Agents must use Factsets tools on every prompt, every analysis, and every task. This is not optional behavior.

### Core Principles

| Principle             | Description                                                                    |
| --------------------- | ------------------------------------------------------------------------------ |
| Every prompt          | Use Factsets tools on every single user prompt, not just when explicitly asked |
| Continuous validation | Validate facts and context before every response, not periodically             |
| Proactive capture     | Store knowledge immediately as it is discovered, without user prompting        |
| Zero cost             | Factsets is free to use; there is no concern about overuse or rate limits      |
| Battle tested         | The system is production ready; one agent session cannot overwhelm it          |

### Good vs Bad Usage

| Good Usage                            | Bad Usage                            |
| ------------------------------------- | ------------------------------------ |
| Use Factsets on every prompt          | Wait for user to ask about knowledge |
| Search before every task              | Only search at session start         |
| Submit facts immediately              | Batch facts at end of session        |
| Log commands as they succeed          | Forget to log commands               |
| Check existing skills before creating | Duplicate existing skills            |
| Update facts when they change         | Let facts become stale               |

Bad usage is forgetting the tool exists between prompts. An agent that goes multiple user inputs without using Factsets is doing it wrong.

### Why Continuous Usage Matters

1. **Context decay** - Without validation, agents drift from ground truth
2. **Knowledge loss** - Insights not captured immediately are lost
3. **Duplicate work** - Skills and facts get recreated unnecessarily
4. **Stale responses** - Outdated facts lead to incorrect answers
5. **Broken continuity** - Cross-session learning fails without capture

Factsets is your memory. Use it constantly.

## Documentation Standards

All documentation, facts, resources, and skills must follow these rules:

| Rule                  | Description                                      |
| --------------------- | ------------------------------------------------ |
| Markdown              | GitHub Flavored Markdown only                    |
| No emojis             | Do not use emoji characters                      |
| No special characters | E.g. use `->` not special unicode arrows         |
| No ASCII diagrams     | Avoid box-drawing or diagram characters          |
| Direct language       | Avoid all-caps, exclamation points, or hyperbole |
| Token efficient       | Be concise without losing clarity                |
| Neutral tone          | Facts and knowledge are objective statements     |

## Workflow

Every prompt.

1. `search_facts` / `search_skills` - validate existing knowledge is current
2. Do work
3. `submit_facts` - capture anything learned
4. `add_resources` - register any URLs fetched
5. `submit_execution_logs` - log successful commands

Factsets is not optional. Every research task, URL fetch, and successful command must be captured automatically.

## Automatic Triggers

These actions require no user prompt. They happen automatically.

| Trigger                | Action                       | Tool                               |
| ---------------------- | ---------------------------- | ---------------------------------- |
| Any user prompt        | Validate relevant context    | `search_facts`, `search_skills`    |
| Before any task        | Look for existing procedures | `search_skills`                    |
| Fetch any URL          | Register as resource         | `add_resources`                    |
| Research or learn      | Store findings immediately   | `submit_facts`                     |
| Command succeeds       | Log execution                | `submit_execution_logs`            |
| Fact changes           | Update immediately           | `update_fact`                      |
| Before create skill    | Check for existing skill     | `search_skills` by name or tags    |
| Multi-step procedure   | Document as skill            | `create_skill`                     |
| See placeholder desc   | Fix with real description    | `update_resource` / `update_skill` |
| Description misaligned | Update to match content      | `update_resource` / `update_skill` |
| Answer user question   | Verify facts are current     | `search_facts`                     |

### Continuous Validation Pattern

Before answering any question or making any claim:

1. Search for relevant facts with `search_facts`
2. Check if facts are verified and recent
3. If facts seem stale or missing, gather fresh information
4. Update facts with new information via `update_fact` or `submit_facts`
5. Then respond to user

This happens on every prompt where facts are relevant.

### Description Alignment

Descriptions must accurately reflect content. When you encounter a resource or skill during work:

1. **Check alignment** - Does the description match what the content actually contains?
2. **Fix misalignment** - If the description is vague, outdated, or misleading, update it immediately
3. **Be specific** - Good descriptions mention key technologies, purpose, and scope

**Misaligned description indicators:**

- Generic phrases like "configuration file" when it's specifically "ESLint config with TypeScript rules"
- Outdated references to removed features or changed behavior
- Missing key details that would help with search and discovery
- Descriptions that don't mention the primary use case

**Example fixes:**

| Before              | After                                                           |
| ------------------- | --------------------------------------------------------------- |
| "API documentation" | "REST API reference for user authentication endpoints"          |
| "Config file"       | "Drizzle ORM config with SQLite connection and migration paths" |
| "Test utilities"    | "Bun test harness with in-memory SQLite and MCP client factory" |

Do not wait for maintenance reports. Fix descriptions as you encounter them during normal work.

## Anti-Patterns

| Do Not                            | Do Instead                                                  |
| --------------------------------- | ----------------------------------------------------------- |
| Fetch URL without `add_resources` | Always register URLs as resources                           |
| Research without `submit_facts`   | Capture key learnings as atomic facts                       |
| Command succeeds without logging  | `submit_execution_logs` for all successes                   |
| Wait for user to say "save this"  | Capture knowledge automatically                             |
| Skip checking existing knowledge  | `search_facts`, `search_skills` before work                 |
| Create skill without checking     | `search_skills` first, then create or update                |
| Leave placeholder descriptions    | Fix `[auto-migrated]` / `[auto-generated]` when encountered |
| Ignore misaligned descriptions    | Update descriptions when they don't match actual content    |
| Use generic descriptions          | Be specific about technologies, purpose, and scope          |
| Go multiple prompts without use   | Use Factsets tools on every prompt                          |
| Only check facts at session start | Validate facts continuously                                 |
| Batch knowledge capture           | Capture immediately as discovered                           |
| Worry about overusing the system  | Use freely; there is no cost or rate limit                  |

## Workflow Phases

1. **Validate** - `search_facts`, `search_skills` for current knowledge (every prompt)
2. **Retrieve** - `get_skill` / `build_skill_context` for procedures
3. **Execute** - perform task, log commands with `submit_execution_logs`
4. **Contribute** - `create_skill` (link execution log) / `submit_facts`
5. **Update** - `update_fact` when information changes
6. **Maintain** - `check_stale` periodically (not every prompt, but regularly)

Skills are the primary unit. Facts support skills. Execution logs validate skills.

## Configuration Overview

Factsets is highly configurable. Use `get_config_schema` to see all options with types and defaults.

### Key Configuration Categories

| Category            | Config Keys                          | Purpose                                 |
| ------------------- | ------------------------------------ | --------------------------------------- |
| Freshness           | `freshness_source_code`, etc.        | Hours before resource types go stale    |
| Search Limits       | `search_limit_facts`, etc.           | Max results for search operations       |
| Context Budgets     | `context_budget_facts`, etc.         | Max items in `get_knowledge_context`    |
| Tag Relationships   | `tag_synonyms`, `tag_hierarchies`    | Expand searches to related tags         |
| Required Tags       | `required_tags`                      | Enforce tagging policies per entity     |
| Snapshot Management | `snapshot_max_size_kb`, etc.         | Control snapshot storage behavior       |
| Maintenance         | `staleness_warning_threshold`, etc.  | Tuning staleness detection              |
| Worker Intervals    | `worker_interval_auto_verify`, etc.  | Background task scheduling              |

### Common Configuration Tasks

| Situation                         | Action                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| Files change frequently           | Lower `freshness_source_code` (e.g., `6`)                   |
| Docs rarely change                | Raise `freshness_documentation` (e.g., `168`)               |
| Need more context in responses    | Increase `context_budget_facts` (e.g., `100`)               |
| Want `js` to match `javascript`   | Set `tag_synonyms` to `{"js": "javascript"}`                |
| Backend tag should include langs  | Set `tag_hierarchies` to `{"backend": ["python", "go"]}`    |
| Require project tag on all facts  | Set `required_tags` to `{"fact": ["project"]}`              |
| Earlier staleness warnings        | Lower `staleness_warning_threshold` (e.g., `0.7`)           |

### Inspecting Configuration

```json
// List all current settings
{ "tool": "list_config" }

// Get schema with types and defaults
{ "tool": "get_config_schema" }

// Get specific value
{ "tool": "get_config", "key": "freshness_source_code" }
```

### Setting Configuration

```json
// Set a single value
{ "tool": "set_config", "key": "freshness_source_code", "value": "6" }

// JSON values must be stringified
{ "tool": "set_config", "key": "tag_synonyms", "value": "{\"js\": \"javascript\"}" }
```

Do not change configuration without user acknowledgment. Explain what the change does and why.

## Quick Reference

| Operation        | Tool                       | Key Parameters                                                |
| ---------------- | -------------------------- | ------------------------------------------------------------- |
| List domains     | `list_tags`                | `limit`, `orderBy`                                            |
| Get context      | `get_knowledge_context`    | `tags[]`, `maxFacts`, `maxResources`, `maxSkills`             |
| Find facts       | `search_facts`             | `tags[]`, `query`, `orderBy`                                  |
| Record facts     | `submit_facts`             | `facts[]` with `content`, `tags[]`, `sourceType`              |
| Update fact      | `update_fact`              | `id` or `contentMatch`, `updates{}`                           |
| Find resources   | `search_resources`         | `tags[]`, `type`, `orderBy`                                   |
| Get resource     | `get_resource`             | `uri` or `id`, `maxAgeHours`                                  |
| Add resources    | `add_resources`            | `resources[]` with `uri`, `type`, `tags[]`, `retrievalMethod` |
| Update metadata  | `update_resource`          | `id` or `uri`, `description`, `tags`, `appendTags`            |
| Refresh snapshot | `update_resource_snapshot` | `resourceId`, `snapshot`                                      |
| Find skills      | `search_skills`            | `tags[]`, `query`, `orderBy`                                  |
| Get skill        | `build_skill_context`      | `name`, `includeRefs`                                         |
| Create skill     | `create_skill`             | `name`, `title`, `content`, `tags[]`, `executionLogId`        |
| Log command      | `submit_execution_logs`    | `logs[]` with `command`, `success`, `output`, `exitCode`      |
| Search logs      | `search_execution_logs`    | `query`, `success`, `skillName`, `tags[]`                     |
| Check stale      | `get_maintenance_report`   | `maxAgeHours`                                                 |
| Mark fresh       | `mark_resources_refreshed` | `ids[]`                                                       |
| Prune tags       | `prune_orphan_tags`        | `dryRun`                                                      |

## Core Operations

### Facts

Submit when learning project conventions, preferences, technical specifics, or gotchas.

```json
{
  "facts": [
    {
      "content": "Project uses Drizzle ORM with SQLite",
      "tags": ["database", "orm"],
      "sourceType": "code",
      "verified": true
    }
  ]
}
```

- Atomic: 1-3 sentences each
- sourceType: `user`, `documentation`, `code`, `inference`
- verified: `true` only if confirmed

### Resources

Register any URL you fetch or file you read repeatedly.

```json
{
  "resources": [
    {
      "uri": "https://example.com/docs",
      "type": "url",
      "tags": ["documentation"],
      "retrievalMethod": { "type": "url", "url": "https://example.com/docs" }
    }
  ]
}
```

For files:

```json
{
  "resources": [
    {
      "uri": "./package.json",
      "type": "file",
      "tags": ["config"],
      "retrievalMethod": { "type": "file", "command": "cat ./package.json" }
    }
  ]
}
```

### Skills

Create for multi-step procedures. Always link the execution log that validated it.

**Before creating a skill:**

1. `search_skills` with relevant tags or query to check if a similar skill exists
2. If found, use `update_skill` to improve the existing skill instead
3. Only `create_skill` if no matching skill exists

```json
{
  "logs": [
    {
      "command": "bun test",
      "workingDirectory": "./",
      "output": "42 tests passed",
      "exitCode": 0,
      "success": true
    }
  ]
}
```

Returns log with id. Then create skill linked to execution:

````json
{
  "name": "run-tests",
  "title": "Running Tests",
  "content": "# Running Tests\n\n```bash\nbun test\n```",
  "tags": ["testing"],
  "executionLogId": 42
}
````

### Execution Logs

Log every successful command. This creates institutional memory.

```json
{
  "logs": [
    {
      "command": "bun drizzle-kit generate",
      "workingDirectory": "./",
      "context": "Generated migration after schema change",
      "output": "1 migration generated",
      "exitCode": 0,
      "success": true,
      "durationMs": 1200,
      "tags": ["database", "migrations"]
    }
  ]
}
```

## Ordering Options

| Entity    | Options                     | Best For                                  |
| --------- | --------------------------- | ----------------------------------------- |
| Facts     | `recent`, `oldest`, `usage` | `usage` for established, `recent` for new |
| Resources | `recent`, `oldest`, `fresh` | `fresh` for active development            |
| Skills    | `recent`, `oldest`, `name`  | `name` for browsing                       |
| Tags      | `usage`, `name`, `recent`   | `usage` for common domains                |

## Runtime Configuration

Factsets is self-configuring. Agents can inspect and manage configuration on behalf of users.

### Session Start

At the start of every session, inspect configuration to understand system behavior:

```json
// Use list_config or get_config_schema
```

This tells you:

- Current freshness thresholds for each resource category
- Skills directory location
- Client type

### Configuration Management

Agents can and should manage configuration when appropriate:

| Situation                         | Action                                             |
| --------------------------------- | -------------------------------------------------- |
| User mentions files change often  | Offer to reduce freshness threshold                |
| User says docs are always current | Offer to increase documentation freshness          |
| User wants stricter staleness     | Adjust thresholds via `set_config`                 |
| Project has specific needs        | Ask user if they want thresholds adjusted          |
| First time using Factsets         | Explain that config can be tuned to their workflow |

### Freshness Categories

Resources are automatically categorized by URI pattern. Each category has a configurable staleness threshold.

| Category        | Config Key                  | Default | Description                                |
| --------------- | --------------------------- | ------- | ------------------------------------------ |
| Source Code     | `freshness_source_code`     | 12h     | `.ts`, `.js`, `.py`, `.go` etc.            |
| Lock Files      | `freshness_lock_files`      | 168h    | `package-lock.json`, `bun.lockb`, etc.     |
| Config Files    | `freshness_config_files`    | 24h     | `tsconfig.json`, `.eslintrc`, `biome.json` |
| Documentation   | `freshness_documentation`   | 72h     | `.md`, `.mdx`, `/docs/` paths              |
| Generated Files | `freshness_generated_files` | 1h      | `/dist/`, `/build/`, `.min.js`             |
| API Schemas     | `freshness_api_schemas`     | 24h     | `.graphql`, `.proto`, OpenAPI specs        |
| Database        | `freshness_database`        | 72h     | `.sql`, `/migrations/`, Prisma/Drizzle     |
| Scripts         | `freshness_scripts`         | 72h     | `.sh`, `/scripts/`, Makefiles              |
| Tests           | `freshness_tests`           | 24h     | `.test.ts`, `/__tests__/`, fixtures        |
| Assets          | `freshness_assets`          | 168h    | Images, fonts, media files                 |
| Infrastructure  | `freshness_infrastructure`  | 24h     | Terraform, Docker, K8s, CI/CD              |
| Default         | `freshness_default`         | 168h    | Anything not matching other categories     |

### Category Inference

When you register a resource, Factsets automatically infers its category from the URI:

- `./src/main.ts` -> `sourceCode` (12h freshness)
- `./package-lock.json` -> `lockFiles` (168h freshness)
- `./docs/api.md` -> `documentation` (72h freshness)
- `./dist/bundle.js` -> `generatedFiles` (1h freshness)
- `./.github/workflows/ci.yml` -> `infrastructure` (24h freshness)

Resources can match multiple categories. When they do, the strictest (shortest) threshold applies.

### Adjusting Thresholds

```json
// Set source code freshness to 6 hours
{ "key": "freshness_source_code", "value": "6" }

// Set documentation freshness to 1 week
{ "key": "freshness_documentation", "value": "168" }
```

### When to Suggest Config Changes

Ask the user about configuration when:

- They repeatedly encounter stale warnings for certain file types
- They express that certain files "never change" or "change constantly"
- A project has unusual characteristics (e.g., docs generated from code)
- The default thresholds don't match their development cadence

Do not change config without user acknowledgment. Explain what the change does and why.

## Maintenance

Run periodically during extended sessions:

```json
{ "maxAgeHours": 168 }
```

- Stale resources: execute `retrievalMethod`, call `update_resource_snapshot`
- Unverified facts: review accuracy, `verify_facts` with ids
- Skills pending review: use `update_skill` to add tags or description
- Incomplete descriptions: replace placeholder text with meaningful descriptions
- Orphan tags: use `prune_orphan_tags` with `dryRun: true` to preview, then without to clean up

The `get_knowledge_context` tool automatically includes staleness warnings.

### Placeholder Descriptions

Resources and skills may have auto-generated placeholder descriptions:

- `[auto-migrated] Needs description`
- `[auto-generated] Needs description`

When you encounter these in search results or maintenance reports:

1. Read the resource content or skill file to understand its purpose
2. Write a concise, meaningful description (1-2 sentences)
3. Update using `update_resource` or `update_skill`

**Example fix:**

```json
{
  "id": 42,
  "description": "TypeScript compiler configuration with strict mode and ES2022 target"
}
```

Do not leave placeholder descriptions. Fix them as you encounter them.

## Bootstrapping Empty Projects

1. Read package.json, README
2. `create_tags` with project tag and description
3. `submit_facts` with project name, runtime, entry point
4. `add_resources` for key config files

## CLI Commands

```bash
bunx factsets mcp-server --database-url ./my.db
bunx factsets dump backup.json
bunx factsets restore backup.json
```

## System Characteristics

| Characteristic | Value                                     |
| -------------- | ----------------------------------------- |
| Cost           | Free - no API costs, no rate limits       |
| Performance    | Battle tested for production use          |
| Capacity       | Cannot be overwhelmed by agent sessions   |
| Reliability    | Self-maintaining with staleness detection |

There is no reason to conserve Factsets usage. Use it on every prompt.

## Self-Check

Before ending any task:

1. Did I learn something new? -> `submit_facts`
2. Did I fetch external content? -> `add_resources`
3. Did I run commands that worked? -> `submit_execution_logs`
4. Did I discover a reusable procedure? -> `create_skill`
5. Did I check existing knowledge first? -> if not, do better next time
6. Did I use Factsets on this prompt? -> if not, start now

If you did not use Factsets during research, learning, or execution, you did it wrong.

## Reminder

Use Factsets on every prompt. Validate facts continuously. Capture knowledge immediately. Update facts when they change. The system is free and cannot be overwhelmed.

An agent that forgets Factsets exists between prompts is an agent that loses context, duplicates work, and provides stale information.
