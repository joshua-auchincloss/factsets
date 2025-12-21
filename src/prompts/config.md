# Factsets Configuration

Factsets supports configuration via CLI flags and runtime settings. Configuration persists in the SQLite database.

## CLI Flags

### mcp-server Command

```bash
bunx factsets mcp-server [options]
```

| Flag                   | Description                                  | Default     |
| ---------------------- | -------------------------------------------- | ----------- |
| `-u`, `--database-url` | Path to SQLite database                      | `.facts.db` |
| `-c`, `--client`       | MCP client type (affects skills directory)   | -           |
| `-s`, `--skills-dir`   | Custom skills directory path                 | -           |
| `-w`, `--watch-skills` | Watch skill files for changes (auto-sync)    | `true`      |
| `--no-watch-skills`    | Disable automatic skill file watching        | -           |
| `--no-seed`            | Disable automatic seeding of starter content | -           |
| `-d`, `--dry`          | Dry run mode (for CI smoke tests)            | -           |

### watch-files Command

```bash
bunx factsets watch-files [options]
```

| Flag                    | Description                           | Default     |
| ----------------------- | ------------------------------------- | ----------- |
| `-u`, `--database-url`  | Path to SQLite database               | `.facts.db` |
| `-p`, `--poll-interval` | Interval (ms) to check for new skills | `5000`      |

The `watch-files` command runs a standalone file watcher that automatically syncs skill files when they change. This is spawned automatically by `mcp-server` unless `--no-watch-skills` is set.

## Runtime Configuration

Use the `set_config` / `get_config` tools to manage configuration at runtime.

### client

Sets the MCP client type, which determines where skill files are stored.

```json
{ "key": "client", "value": "github-copilot" }
```

Supported clients and their skills directories:

| Client           | Skills Directory          | Notes                              |
| ---------------- | ------------------------- | ---------------------------------- |
| `github-copilot` | `.github/prompts/skills/` | GitHub Copilot custom instructions |
| `cursor`         | `.cursor/prompts/skills/` | Cursor AI workspace prompts        |
| `windsurf`       | `.windsurf/skills/`       | Windsurf AI configuration          |
| `claude-desktop` | `.claude/skills/`         | Claude Desktop local config        |

If no client is set, skills default to `.github/prompts/skills/`.

### skills_dir

Override the default skills directory with a custom path. Takes precedence over `client`.

```json
{ "key": "skills_dir", "value": "./my-custom-skills/" }
```

When changing `skills_dir`, you can migrate existing skills:

```json
{ "key": "skills_dir", "value": "./new-path/", "migrate": true }
```

## Environment Variables

| Variable       | Description             | Default     |
| -------------- | ----------------------- | ----------- |
| `DATABASE_URL` | Path to SQLite database | `.facts.db` |

CLI flags take precedence over environment variables.

## Configuration Precedence

1. CLI flags (highest priority)
2. Runtime config (`set_config`)
3. Environment variables
4. Defaults (lowest priority)

## Freshness Configuration

Factsets uses category-based freshness thresholds to determine when resources are stale. Each category has a configurable threshold in hours.

### Categories and Defaults

| Category        | Config Key                  | Default | Typical Files                               |
| --------------- | --------------------------- | ------- | ------------------------------------------- |
| Source Code     | `freshness_source_code`     | 12h     | `.ts`, `.js`, `.py`, `.go`, `.rs`           |
| Lock Files      | `freshness_lock_files`      | 168h    | `package-lock.json`, `bun.lockb`, `go.sum`  |
| Config Files    | `freshness_config_files`    | 24h     | `tsconfig.json`, `.eslintrc`, `biome.json`  |
| Documentation   | `freshness_documentation`   | 72h     | `.md`, `.mdx`, `/docs/` paths               |
| Generated Files | `freshness_generated_files` | 1h      | `/dist/`, `/build/`, `.min.js`, source maps |
| API Schemas     | `freshness_api_schemas`     | 24h     | `.graphql`, `.proto`, OpenAPI, AsyncAPI     |
| Database        | `freshness_database`        | 72h     | `.sql`, `/migrations/`, Prisma, Drizzle     |
| Scripts         | `freshness_scripts`         | 72h     | `.sh`, `/scripts/`, Makefiles, Justfiles    |
| Tests           | `freshness_tests`           | 24h     | `.test.ts`, `.spec.js`, `/__tests__/`       |
| Assets          | `freshness_assets`          | 168h    | Images, fonts, video, audio, PDFs           |
| Infrastructure  | `freshness_infrastructure`  | 24h     | Terraform, Docker, K8s, GitHub Actions      |
| Default         | `freshness_default`         | 168h    | Anything not matching specific categories   |

### Automatic Category Inference

When resources are registered, Factsets automatically infers their category from the URI using pattern matching:

```
./src/main.ts          -> sourceCode (12h)
./package-lock.json    -> lockFiles (168h)
./docs/api.md          -> documentation (72h)
./dist/bundle.min.js   -> generatedFiles (1h)
./.github/workflows/ci.yml -> infrastructure (24h)
./tests/unit.test.ts   -> tests (24h)
```

Resources can match multiple categories. When they do, the strictest (shortest) threshold applies to ensure stale content is caught.

### Adjusting Thresholds

Use `set_config` to adjust any threshold:

```json
// Active development: check source more often
{ "key": "freshness_source_code", "value": "6" }

// Stable docs: check less frequently
{ "key": "freshness_documentation", "value": "168" }

// Generated files that change rarely
{ "key": "freshness_generated_files", "value": "24" }
```

### Use Cases for Custom Thresholds

| Scenario                         | Adjustment                               |
| -------------------------------- | ---------------------------------------- |
| Rapid development                | Lower `freshness_source_code` to 4-6h    |
| Stable production docs           | Raise `freshness_documentation` to 168h  |
| Frequently updated API specs     | Lower `freshness_api_schemas` to 12h     |
| Long-running CI without rebuilds | Raise `freshness_generated_files` to 24h |
| Database migrations happen often | Lower `freshness_database` to 24h        |

## Examples

### GitHub Copilot Setup

```bash
bunx factsets mcp-server --client github-copilot
```

Skills will be saved to `.github/prompts/skills/`, making them available as GitHub Copilot custom instructions.

### Cursor Setup

```bash
bunx factsets mcp-server --client cursor
```

Skills will be saved to `.cursor/prompts/skills/`.

### Custom Directory

```bash
bunx factsets mcp-server --skills-dir ./docs/knowledge/
```

### CI Smoke Test

```bash
bunx factsets mcp-server --dry
```

Exits 0 if server initializes successfully.

## Default Values

The following defaults apply to search operations:

| Parameter     | Entity    | Default | Description                            |
| ------------- | --------- | ------- | -------------------------------------- |
| `limit`       | facts     | 50      | Maximum facts returned                 |
| `limit`       | resources | 100     | Maximum resources returned             |
| `limit`       | skills    | 30      | Maximum skills returned                |
| `limit`       | tags      | 100     | Maximum tags returned                  |
| `limit`       | exec logs | 50      | Maximum execution logs returned        |
| `maxAgeHours` | staleness | 168     | Hours before content is stale (7 days) |
| `maxAgeHours` | resources | 1       | Hours for isFresh determination        |

## System Seeding

On first run, Factsets automatically seeds starter content to help new users get started:

- Tags: `factsets:system`, `getting-started`, `best-practices`, `agent-workflow`
- Facts: best practices for facts, skills, and agent workflows
- Skills: a quickstart guide skill document

### Seed Behavior

- Seeding runs once per version (tracked via `system_seed_version` config key)
- System content is marked with `systemId` and `systemHash` fields
- Content with the `factsets:system` tag should not be deleted
- If you modify seeded content, future updates will not overwrite your changes

### Disabling Seeding

Use `--no-seed` to skip seeding:

```bash
bunx factsets mcp-server --no-seed
```

## Search Limits

Fine-tune how many results are returned from search operations:

| Config Key                    | Default | Description                       |
| ----------------------------- | ------- | --------------------------------- |
| `search_limit_tags`           | 100     | Maximum tags returned             |
| `search_limit_facts`          | 50      | Maximum facts returned            |
| `search_limit_resources`      | 100     | Maximum resources returned        |
| `search_limit_skills`         | 30      | Maximum skills returned           |
| `search_limit_execution_logs` | 50      | Maximum execution logs returned   |
| `search_include_deleted`      | false   | Include soft-deleted items        |

```json
// Increase facts limit for research tasks
{ "key": "search_limit_facts", "value": "200" }
```

## Context Budgets

Control how much content is included in knowledge context responses:

| Config Key               | Default | Description                         |
| ------------------------ | ------- | ----------------------------------- |
| `context_budget_facts`   | 50      | Max facts in knowledge context      |
| `context_budget_resources` | 20    | Max resources in knowledge context  |
| `context_budget_skills`  | 10      | Max skills in knowledge context     |

These budgets apply to `get_knowledge_context` and the `knowledge_context` prompt.

```json
// Larger context for complex tasks
{ "key": "context_budget_facts", "value": "100" }
{ "key": "context_budget_resources", "value": "50" }
```

## Tag Relationships

### Tag Synonyms

Define equivalent tags that should be treated as the same during search:

| Config Key      | Type   | Default |
| --------------- | ------ | ------- |
| `tag_synonyms`  | JSON   | `{}`    |

```json
// Set up synonyms
{
  "key": "tag_synonyms",
  "value": "{\"js\": \"javascript\", \"ts\": \"typescript\", \"py\": \"python\"}"
}
```

When searching for `js`, results tagged with `javascript` will also be included (and vice versa).

### Tag Hierarchies

Define parent-child relationships between tags. Searching for a parent includes all children:

| Config Key        | Type   | Default |
| ----------------- | ------ | ------- |
| `tag_hierarchies` | JSON   | `{}`    |

```json
// Backend tag includes all backend languages
{
  "key": "tag_hierarchies",
  "value": "{\"backend\": [\"python\", \"node\", \"go\", \"rust\"]}"
}
```

Searching for `backend` will return results tagged with `python`, `node`, `go`, or `rust`.

### Required Tags

Enforce that certain entity types must have specific tags:

| Config Key      | Type   | Default |
| --------------- | ------ | ------- |
| `required_tags` | JSON   | `{}`    |

```json
// Require project tag on facts, and team prefix on skills
{
  "key": "required_tags",
  "value": "{\"fact\": [\"project\"], \"skill\": [\"team-*\"]}"
}
```

Supported patterns:
- Exact match: `"project"` - tag must be exactly "project"
- Prefix match: `"team-*"` - tag must start with "team-"

Entity types: `fact`, `resource`, `skill`

## Snapshot Management

Control how resource snapshots are stored and managed:

| Config Key                     | Default     | Description                                    |
| ------------------------------ | ----------- | ---------------------------------------------- |
| `snapshot_max_size_kb`         | 100         | Max snapshot size in KB before overflow        |
| `snapshot_overflow_behavior`   | `truncate`  | What to do when snapshot exceeds max size      |
| `snapshot_retention_versions`  | 3           | Number of snapshot versions to retain          |

### Overflow Behaviors

| Behavior        | Description                                              |
| --------------- | -------------------------------------------------------- |
| `truncate`      | Cut content at the size limit                            |
| `summarize`     | Attempt to summarize or extract key content              |
| `remove_noise`  | Remove HTML, boilerplate, whitespace before truncating   |
| `auto`          | Use `remove_noise` first, then `truncate` if still large |

```json
// Larger snapshots with noise removal
{ "key": "snapshot_max_size_kb", "value": "200" }
{ "key": "snapshot_overflow_behavior", "value": "auto" }
```

## Maintenance Settings

### Auto Prune Orphan Tags

| Config Key              | Default | Description                          |
| ----------------------- | ------- | ------------------------------------ |
| `auto_prune_orphan_tags`| false   | Automatically prune unused tags      |

When enabled, tags with zero usage are automatically removed during background maintenance.

### Soft Delete Retention

| Config Key                  | Default | Description                           |
| --------------------------- | ------- | ------------------------------------- |
| `soft_delete_retention_days`| 7       | Days to retain soft-deleted items     |

After this period, soft-deleted items are hard-deleted by the background worker.

### Staleness Warning Threshold

| Config Key                    | Default | Description                              |
| ----------------------------- | ------- | ---------------------------------------- |
| `staleness_warning_threshold` | 0.8     | Fraction (0.0-1.0) before warning        |

When a resource reaches this percentage of its max age, it's flagged as "approaching stale" in `get_knowledge_context`:

```json
// Warn at 70% of staleness threshold
{ "key": "staleness_warning_threshold", "value": "0.7" }
```

Example: With a 24h freshness threshold and 0.8 warning threshold, resources are flagged as "approaching stale" at 19.2 hours.

## Background Worker

The background worker performs periodic maintenance tasks. Run it separately:

```bash
bunx factsets worker --database-url .facts.db
```

### Worker Task Intervals

| Config Key                        | Default  | Description                          |
| --------------------------------- | -------- | ------------------------------------ |
| `worker_interval_auto_verify`     | 3600000  | Auto-verify old facts (ms)           |
| `worker_interval_expire_facts`    | 7200000  | Expire unverified facts (ms)         |
| `worker_interval_prune_snapshots` | 86400000 | Prune old snapshot versions (ms)     |
| `worker_interval_prune_tags`      | 86400000 | Prune orphan tags (ms)               |
| `worker_interval_hard_delete`     | 86400000 | Hard-delete expired soft deletes (ms)|

Default values: auto-verify (1h), expire facts (2h), others (24h).

```json
// More frequent auto-verification
{ "key": "worker_interval_auto_verify", "value": "1800000" }
```

### Worker Tasks

| Task           | Description                                                |
| -------------- | ---------------------------------------------------------- |
| Auto-verify    | Mark unverified facts older than 7 days as verified        |
| Expire facts   | Soft-delete unverified facts older than 30 days            |
| Prune tags     | Remove tags with zero usage (if `auto_prune_orphan_tags`)  |
| Hard delete    | Permanently remove items past `soft_delete_retention_days` |

Worker state is persisted in the database, so it survives restarts and resumes from where it left off.

## Advanced Configuration

### Tag Affinity Weights

Experimental: Assign weights to tags for relevance scoring.

| Config Key           | Type   | Default |
| -------------------- | ------ | ------- |
| `tag_affinity_weights` | JSON | `{}`    |

### Source Type Trust

Configure trust levels for different fact source types:

| Config Key          | Type   | Default                                                  |
| ------------------- | ------ | -------------------------------------------------------- |
| `source_type_trust` | JSON   | `{"user": 1.0, "documentation": 0.9, "code": 0.8, "inference": 0.6}` |

```json
// Lower trust for AI-inferred facts
{
  "key": "source_type_trust",
  "value": "{\"user\": 1.0, \"documentation\": 0.95, \"code\": 0.85, \"inference\": 0.5}"
}
```

## Viewing Configuration

Use `list_config` to see all current settings:

```json
{
  "config": [
    { "key": "client", "value": "github-copilot" },
    { "key": "skills_dir", "value": ".github/prompts/skills/" },
    { "key": "freshness_source_code", "value": "12" },
    { "key": "context_budget_facts", "value": "50" }
  ]
}
```

Use `get_config_schema` to see all available configuration options with their types and defaults.
