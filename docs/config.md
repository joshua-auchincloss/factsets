# Factsets Configuration

Factsets supports configuration via CLI flags and runtime settings. Configuration persists in the SQLite database.

## CLI Flags

### `mcp-server` Command

```bash
bunx factsets mcp-server [options]
```

### `watch-files` Command

```bash
bunx factsets watch-files [options]
```

| Flag                   | Description                              | Default      |
| ---------------------- | ---------------------------------------- | ------------ |
| `-u`, `--database-url` | Path to SQLite database                  | `.facts.db`  |
| `-p`, `--poll-interval`| Interval (ms) to check for new skills    | `5000`       |

The `watch-files` command runs a standalone file watcher that automatically syncs skill files when they change. This is spawned automatically by `mcp-server` unless `--no-watch-skills` is set.

| Flag                        | Description                                    | Default      |
| --------------------------- | ---------------------------------------------- | ------------ |
| `-u`, `--database-url`      | Path to SQLite database                        | `.facts.db`  |
| `-c`, `--client`            | MCP client type (affects skills directory)     | —            |
| `-s`, `--skills-dir`        | Custom skills directory path                   | —            |
| `-w`, `--watch-skills`      | Watch skill files for changes (auto-sync)      | `true`       |
| `--no-watch-skills`         | Disable automatic skill file watching          | —            |
| `--no-seed`                 | Disable automatic seeding of starter content   | —            |
| `-d`, `--dry`               | Dry run mode (for CI smoke tests)              | —            |

## Runtime Configuration

Use the `set_config` / `get_config` tools to manage configuration at runtime.

### `client`

Sets the MCP client type, which determines where skill files are stored.

```json
{ "key": "client", "value": "github-copilot" }
```

**Supported clients and their skills directories:**

| Client           | Skills Directory          | Notes                              |
| ---------------- | ------------------------- | ---------------------------------- |
| `github-copilot` | `.github/prompts/skills/` | GitHub Copilot custom instructions |
| `cursor`         | `.cursor/prompts/skills/` | Cursor AI workspace prompts        |
| `windsurf`       | `.windsurf/skills/`       | Windsurf AI configuration          |
| `claude-desktop` | `.claude/skills/`         | Claude Desktop local config        |

If no client is set, skills default to `.github/prompts/skills/`.

### `skills_dir`

Override the default skills directory with a custom path. Takes precedence over `client`.

```json
{ "key": "skills_dir", "value": "./my-custom-skills/" }
```

When changing `skills_dir`, you can migrate existing skills:

```json
// Via MCP tool
set_config { "key": "skills_dir", "value": "./new-path/", "migrate": true }
```

## Environment Variables

| Variable       | Description              | Default     |
| -------------- | ------------------------ | ----------- |
| `DATABASE_URL` | Path to SQLite database  | `.facts.db` |

CLI flags take precedence over environment variables.

## Configuration Precedence

1. CLI flags (highest priority)
2. Runtime config (`set_config`)
3. Environment variables
4. Defaults (lowest priority)

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
# Exits 0 if server initializes successfully
```

## Default Values

The following defaults apply to search operations:

| Parameter      | Entity    | Default | Description                           |
| -------------- | --------- | ------- | ------------------------------------- |
| `limit`        | facts     | 50      | Maximum facts returned                |
| `limit`        | resources | 100     | Maximum resources returned            |
| `limit`        | skills    | 30      | Maximum skills returned               |
| `limit`        | tags      | 100     | Maximum tags returned                 |
| `limit`        | exec logs | 50      | Maximum execution logs returned       |
| `maxAgeHours`  | staleness | 168     | Hours before content is stale (7 days)|
| `maxAgeHours`  | resources | 1       | Hours for isFresh determination       |

## System Seeding

On first run, Factsets automatically seeds starter content to help new users get started:

- **Tags**: `factsets:system`, `getting-started`, `best-practices`, `agent-workflow`
- **Facts**: Best practices for facts, skills, and agent workflows
- **Skills**: A quickstart guide skill document

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

## Viewing Configuration

Use `list_config` to see all current settings:

```json
// Returns
{
  "config": [
    { "key": "client", "value": "github-copilot" },
    { "key": "skills_dir", "value": ".github/prompts/skills/" }
  ]
}
```
