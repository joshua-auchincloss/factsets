# Understanding Factsets Architecture

## Core Concept

Factsets is a **metadata-only** knowledge management system for AI agents. It does NOT fetch or execute anything - it
stores:

- **Facts**: Atomic knowledge (1-3 sentences)
- **Resources**: URIs with retrieval instructions
- **Skills**: Markdown procedural knowledge

Agents use the stored metadata and retrieval methods to fetch content themselves.

## Data Flow

```
Agent discovers fact → submits to factsets → tagged and stored
Agent needs context → queries by tags → gets facts + retrieval methods
Agent fetches resource → updates snapshot in factsets → staleness tracked
```

## Key Design Decisions

### No Confidence Scores

Confidence is context-window scoped. A fact's certainty during creation doesn't persist. Instead:

- `verified`: User-confirmed truth
- `source_type`: How it was derived (user, code, inference)
- `updated_at`: Freshness indicator

### Staleness Detection

Resources store `snapshot_hash`. When checked:

1. Compare current hash to stored hash
1. If different, skill dependencies are flagged
1. Return retrieval method for agent to refresh

### Skills on Filesystem

Skills are markdown files (for editor integration) with DB-tracked metadata:

- References to facts, resources, other skills
- Content hash for change detection
- Tag associations

## Directory Structure

```
src/
├── commands/       # CLI command handlers (dump, restore, mcp-server)
├── db/
│   ├── schema.ts   # Drizzle schema
│   ├── operations/ # CRUD operations per entity
│   └── index.ts    # Connection management
├── schemas/        # Zod validation schemas
├── tools/          # MCP tool registrations
├── prompts/        # MCP prompt registrations
└── main.ts         # CLI entry point
```

## CLI Commands

- `mcp-server` - Start MCP server (primary mode), spawns file watcher by default
- `watch-files` - Standalone file watcher for skill auto-sync
- `dump <file>` - Export all data to JSON for backup/migration
- `restore <file>` - Import data from JSON dump

### File Watcher

The MCP server automatically spawns a file watcher subprocess (`--watch-skills=true` by default):

- Watches the skills directory for new `.md` files
- Watches each skill file individually using Node.js `fs.watch`
- Auto-syncs content hash when files change (100ms debounce)
- Auto-registers new `.md` files as skills with `needsReview=true`
- Auto-removes skills when their files are deleted
- Handles skills directory changes (config updates)
- Periodically polls for changes (default 5000ms)
- Disable with `--no-watch-skills` flag
- Run standalone with `bunx factsets watch-files`

### Auto-Discovered Skills

When new `.md` files are added to the skills directory outside of Factsets:

1. File watcher detects the new file
2. Skill is auto-registered with title extracted from first `#` heading
3. Skill is flagged with `needsReview=true`
4. Appears in maintenance report under "Skills Pending Review"
5. Once updated via `update_skill` (add tags, description), review flag clears

## MCP Integration

Factsets exposes all operations via MCP:

- **Tools**: CRUD operations (submit_facts, add_resources, etc.)
- **Prompts**: Context builders (knowledge_context, maintenance_report)

Tools return JSON, prompts return formatted markdown for agent consumption.

## Client Adaptation

Different AI clients have different conventions:

- GitHub Copilot: `.github/prompts/skills/`
- Cursor: `.cursor/prompts/skills/`
- Claude: `.claude/skills/`

Configure via `set_config` tool or auto-detect.

## System Seeding

Factsets pre-populates new installations with starter content:

### Seed Components

- **Tags**: `factsets:system`, `getting-started`, `best-practices`, `agent-workflow`
- **Facts**: Best practices for atomic facts, tagging, agent interaction
- **Skills**: Quickstart guide document

### Version Tracking

- `system_seed_version` config key tracks applied version
- Manifest version in `src/seed/manifest.ts` defines content
- Seeding only runs when stored version < manifest version

### Change Detection

- `systemId`: Unique identifier for system content (e.g., `factsets:fact:atomic-facts`)
- `systemHash`: Hash of original content
- If user modifies content (hash mismatch), updates are skipped

### Opt-out

Use `--no-seed` flag to disable automatic seeding:

```bash
bunx factsets mcp-server --no-seed
```
