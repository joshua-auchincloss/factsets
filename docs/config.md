# Factsets Configuration

Factsets supports configuration via CLI flags and runtime settings. Configuration persists in the SQLite database.

> **For agents**: Call `get_config_schema` to get the definitive, up-to-date configuration schema with all available keys, types, defaults, and valid values. This document provides context and examples, but the schema tool is the authoritative reference.

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

Use the `set_config` / `get_config` tools to manage configuration at runtime. Use `get_config_schema` to see all available configuration keys with their types, defaults, and valid values.

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

> Call `get_config_schema` for the complete list of freshness keys and their current defaults.

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

## When to Suggest Configuration Changes

| User Says                    | Config to Suggest       | Value         |
| ---------------------------- | ----------------------- | ------------- |
| "Files change a lot"         | `freshness_source_code` | 4-6           |
| "Docs are always outdated"   | `freshness_documentation` | 24          |
| "I need more context"        | `context_budget_facts`  | 100           |
| "Search is not finding X"    | `tag_synonyms`          | Add mapping   |
| "Backend should include API" | `tag_hierarchies`       | Add hierarchy |
| "Always include project tag" | `required_tags`         | Add rule      |

### DO NOT Change Without Asking

- Any freshness threshold
- Skills directory location
- Required tags
- Search limits

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

| Config Key                    | Default | Description                     |
| ----------------------------- | ------- | ------------------------------- |
| `search_limit_tags`           | 100     | Maximum tags returned           |
| `search_limit_facts`          | 50      | Maximum facts returned          |
| `search_limit_resources`      | 100     | Maximum resources returned      |
| `search_limit_skills`         | 30      | Maximum skills returned         |
| `search_limit_execution_logs` | 50      | Maximum execution logs returned |
| `search_include_deleted`      | false   | Include soft-deleted items      |

```json
// Increase facts limit for research tasks
{ "key": "search_limit_facts", "value": "200" }
```

## Context Budgets

Control how much content is included in knowledge context responses:

| Config Key                 | Default | Description                        |
| -------------------------- | ------- | ---------------------------------- |
| `context_budget_facts`     | 50      | Max facts in knowledge context     |
| `context_budget_resources` | 20      | Max resources in knowledge context |
| `context_budget_skills`    | 10      | Max skills in knowledge context    |

These budgets apply to `get_knowledge_context` and the `knowledge_context` prompt.

```json
// Larger context for complex tasks
{ "key": "context_budget_facts", "value": "100" }
{ "key": "context_budget_resources", "value": "50" }
```

## Tag Relationships

### Tag Synonyms

Define equivalent tags that should be treated as the same during search:

| Config Key     | Type | Default |
| -------------- | ---- | ------- |
| `tag_synonyms` | JSON | `{}`    |

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

| Config Key        | Type | Default |
| ----------------- | ---- | ------- |
| `tag_hierarchies` | JSON | `{}`    |

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

| Config Key      | Type | Default |
| --------------- | ---- | ------- |
| `required_tags` | JSON | `{}`    |

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

| Config Key                    | Default    | Description                               |
| ----------------------------- | ---------- | ----------------------------------------- |
| `snapshot_max_size_kb`        | 100        | Max snapshot size in KB before overflow   |
| `snapshot_overflow_behavior`  | `truncate` | What to do when snapshot exceeds max size |
| `snapshot_retention_versions` | 3          | Number of snapshot versions to retain     |

### Overflow Behaviors

| Behavior       | Description                                              |
| -------------- | -------------------------------------------------------- |
| `truncate`     | Cut content at the size limit                            |
| `summarize`    | Attempt to summarize or extract key content              |
| `remove_noise` | Remove HTML, boilerplate, whitespace before truncating   |
| `auto`         | Use `remove_noise` first, then `truncate` if still large |

```json
// Larger snapshots with noise removal
{ "key": "snapshot_max_size_kb", "value": "200" }
{ "key": "snapshot_overflow_behavior", "value": "auto" }
```

## Maintenance Settings

### Auto Prune Orphan Tags

| Config Key               | Default | Description                     |
| ------------------------ | ------- | ------------------------------- |
| `auto_prune_orphan_tags` | false   | Automatically prune unused tags |

When enabled, tags with zero usage are automatically removed during background maintenance.

### Soft Delete Retention

| Config Key                   | Default | Description                       |
| ---------------------------- | ------- | --------------------------------- |
| `soft_delete_retention_days` | 7       | Days to retain soft-deleted items |

After this period, soft-deleted items are hard-deleted by the background worker.

### Staleness Warning Threshold

| Config Key                    | Default | Description                       |
| ----------------------------- | ------- | --------------------------------- |
| `staleness_warning_threshold` | 0.8     | Fraction (0.0-1.0) before warning |

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

| Config Key                        | Default  | Description                           |
| --------------------------------- | -------- | ------------------------------------- |
| `worker_interval_auto_verify`     | 3600000  | Auto-verify old facts (ms)            |
| `worker_interval_expire_facts`    | 7200000  | Expire unverified facts (ms)          |
| `worker_interval_prune_snapshots` | 86400000 | Prune old snapshot versions (ms)      |
| `worker_interval_prune_tags`      | 86400000 | Prune orphan tags (ms)                |
| `worker_interval_hard_delete`     | 86400000 | Hard-delete expired soft deletes (ms) |

Default values: auto-verify (1h), expire facts (2h), others (24h).

```json
// More frequent auto-verification
{ "key": "worker_interval_auto_verify", "value": "1800000" }
```

### Worker Tasks

| Task         | Description                                                |
| ------------ | ---------------------------------------------------------- |
| Auto-verify  | Mark unverified facts older than 7 days as verified        |
| Expire facts | Soft-delete unverified facts older than 30 days            |
| Prune tags   | Remove tags with zero usage (if `auto_prune_orphan_tags`)  |
| Hard delete  | Permanently remove items past `soft_delete_retention_days` |

Worker state is persisted in the database, so it survives restarts and resumes from where it left off.

## Advanced Configuration

### Tag Affinity Weights

Experimental: Assign weights to tags for relevance scoring.

| Config Key             | Type | Default |
| ---------------------- | ---- | ------- |
| `tag_affinity_weights` | JSON | `{}`    |

### Source Type Trust

Configure trust levels for different fact source types:

| Config Key          | Type | Default                                                              |
| ------------------- | ---- | -------------------------------------------------------------------- |
| `source_type_trust` | JSON | `{"user": 0.9, "documentation": 0.9, "code": 0.8, "inference": 0.6}` |

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

## User Preferences

User preferences control how agents generate responses, code, and documentation. These preferences are automatically applied when generating output and can be inferred from user feedback.\n\n> Call `get_config_schema` for the complete list of 30+ preference keys with their types, defaults, and valid values.

### Preference Tools

| Tool                    | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `get_user_preferences`  | Get all preferences as structured JSON                 |
| `get_preference_prompt` | Get natural language prompt describing all preferences |
| `infer_preference`      | Update a preference based on user feedback             |
| `reset_preferences`     | Reset preferences to defaults                          |

### Communication & Response Style

| Config Key           | Default   | Values                                                        | Description        |
| -------------------- | --------- | ------------------------------------------------------------- | ------------------ |
| `pref_tone`          | `neutral` | `formal`, `neutral`, `casual`, `technical`                    | Communication tone |
| `pref_verbosity`     | `concise` | `minimal`, `concise`, `balanced`, `detailed`, `comprehensive` | Response length    |
| `pref_emoji_usage`   | `banned`  | `banned`, `minimal`, `moderate`, `liberal`                    | Emoji policy       |
| `pref_special_chars` | `banned`  | `banned`, `minimal`, `allowed`                                | Decorative unicode |
| `pref_personality`   | `direct`  | `direct`, `friendly`, `professional`, `instructive`           | Interaction style  |

**Note**: `banned` values are strictly enforced - agents must not use any emojis or decorative unicode when these are set.

### Response Structure

| Config Key                | Default            | Values                                | Description              |
| ------------------------- | ------------------ | ------------------------------------- | ------------------------ |
| `pref_structure_style`    | `flat`             | `flat`, `hierarchical`, `progressive` | Information organization |
| `pref_summary_position`   | `omit`             | `omit`, `first`, `last`, `both`       | TL;DR placement          |
| `pref_use_headers`        | `true`             | `true`, `false`                       | Markdown headers         |
| `pref_use_lists`          | `when_appropriate` | `avoid`, `when_appropriate`, `prefer` | List usage               |
| `pref_section_dividers`   | `banned`           | `banned`, `minimal`, `allowed`        | Section dividers/rules   |
| `pref_code_block_context` | `minimal`          | `omit`, `minimal`, `moderate`, `full` | Code explanation         |

### Code Output

| Config Key                   | Default       | Values                                              | Description            |
| ---------------------------- | ------------- | --------------------------------------------------- | ---------------------- |
| `pref_code_comments`         | `minimal`     | `banned`, `minimal`, `moderate`, `verbose`          | Inline comments        |
| `pref_code_inline_comments`  | `critical`    | `banned`, `critical`, `logical_branches`, `verbose` | Function body comments |
| `pref_code_banners`          | `banned`      | `banned`, `minimal`, `allowed`                      | Decorative banners     |
| `pref_code_docstrings`       | `public_only` | `omit`, `public_only`, `all`                        | Docstrings             |
| `pref_code_type_annotations` | `explicit`    | `minimal`, `inferred`, `explicit`, `strict`         | Type annotations       |
| `pref_code_error_handling`   | `defensive`   | `minimal`, `defensive`, `comprehensive`             | Error handling         |
| `pref_code_naming_notes`     | `null`        | freeform                                            | Naming conventions     |
| `pref_code_line_length`      | `100`         | 60-200                                              | Line length target     |
| `pref_code_imports_style`    | `grouped`     | `minimal`, `explicit`, `grouped`                    | Import organization    |

### Documentation Output

| Config Key                  | Default    | Values                                         | Description     |
| --------------------------- | ---------- | ---------------------------------------------- | --------------- |
| `pref_docs_format`          | `markdown` | `plain`, `markdown`, `rich`                    | Format          |
| `pref_docs_examples`        | `minimal`  | `omit`, `minimal`, `moderate`, `comprehensive` | Examples        |
| `pref_docs_diagrams`        | `omit`     | `omit`, `ascii`, `mermaid`                     | Diagrams        |
| `pref_docs_technical_depth` | `balanced` | `simplified`, `balanced`, `detailed`, `expert` | Technical depth |

### Interaction Behavior

| Config Key              | Default           | Values                                        | Description           |
| ----------------------- | ----------------- | --------------------------------------------- | --------------------- |
| `pref_confirmations`    | `minimal`         | `skip`, `minimal`, `always`                   | Confirmation requests |
| `pref_suggestions`      | `when_relevant`   | `omit`, `when_relevant`, `proactive`          | Proactive suggestions |
| `pref_questions`        | `clarifying_only` | `avoid`, `clarifying_only`, `exploratory`     | Question behavior     |
| `pref_error_detail`     | `actionable`      | `minimal`, `actionable`, `diagnostic`, `full` | Error reporting       |
| `pref_progress_updates` | `false`           | `true`, `false`                               | Progress on long ops  |

### Language & Format

| Config Key             | Default    | Values                              | Description       |
| ---------------------- | ---------- | ----------------------------------- | ----------------- |
| `pref_language`        | `en`       | ISO 639-1                           | Response language |
| `pref_technical_terms` | `standard` | `simplified`, `standard`, `precise` | Terminology level |
| `pref_date_format`     | `ISO`      | `ISO`, `US`, `EU`, `relative`       | Date format       |
| `pref_number_format`   | `standard` | `standard`, `grouped`               | Number format     |

### Using get_preference_prompt

The `get_preference_prompt` tool generates a natural language description of all preferences:

```
# User Preferences

Follow these preferences when generating responses:

- User prefers neutral, balanced tone
...
- User prefers standard number format
```

### Inferring Preferences

Use `infer_preference` when a user expresses a preference:

```json
// User says "no emojis please"
{
  "key": "pref_emoji_usage",
  "value": "banned",
  "reason": "User explicitly requested no emojis",
  "confidence": 1.0,
  "explicit": true
}

// Agent infers user prefers concise responses
{
  "key": "pref_verbosity",
  "value": "minimal",
  "reason": "User consistently asks for shorter responses",
  "confidence": 0.85,
  "explicit": false
}
```

**Inference rules:**

- Explicit preferences (`explicit: true`) are always applied
- Inferred preferences require `confidence >= 0.8`
- Inferred preferences do not override explicit user settings

## Detecting User Preferences

### Explicit Signals (confidence: 1.0, explicit: true)

- "No emojis" -> `pref_emoji_usage: banned`
- "Be more concise" -> `pref_verbosity: minimal`
- "Add more comments" -> `pref_code_comments: verbose`
- "Skip confirmations" -> `pref_confirmations: skip`

### Implicit Signals (confidence: 0.8-0.9)

- User edits your response to remove something -> infer they do not want it
- User asks for more detail repeatedly -> `pref_verbosity: detailed`
- User always uses specific date format -> `pref_date_format: match it`
- User never uses your suggested alternatives -> `pref_suggestions: omit`

### Observation Window

Track over 3+ interactions before inferring implicit preferences.
Do not infer implicitly from single interactions.

### Examples

```json
// User wants verbose code documentation
{ "key": "pref_code_comments", "value": "verbose" }
{ "key": "pref_code_docstrings", "value": "all" }

// User wants minimal interaction
{ "key": "pref_confirmations", "value": "skip" }
{ "key": "pref_questions", "value": "avoid" }
{ "key": "pref_suggestions", "value": "omit" }

// User wants detailed explanations
{ "key": "pref_verbosity", "value": "detailed" }
{ "key": "pref_code_block_context", "value": "full" }
{ "key": "pref_docs_technical_depth", "value": "expert" }
```
