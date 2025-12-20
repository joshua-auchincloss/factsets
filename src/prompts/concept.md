# Factsets: Self-Maintaining Agent Context System

## Problem Statement

AI agents face fundamental limitations:

1. **Ephemeral context** - Every session starts fresh; learned knowledge evaporates
1. **Token inefficiency** - Users re-explain concepts; agents re-discover patterns
1. **No persistent learning** - Corrections and insights vanish after sessions
1. **Resource amnesia** - Repeatedly fetch same docs, re-read same files
1. **Skill degradation** - Trial-and-error improvements aren't captured

## Core Philosophy

Factsets enables agents to **self-maintain** their operational context. Rather than relying on users to provide context
or massive context windows to hold everything, agents actively curate their knowledge base.

Key principles:

- **Atomic knowledge units** - Small, digestible pieces that compose well
- **Self-curation** - Agents decide what's worth remembering
- **Searchability over storage** - Find the right context, not all context
- **Reproducibility** - Not just what, but how to get it again
- **Progressive refinement** - Knowledge improves through use

## Core Concepts

### Facts

Atomic units of knowledge about a project, codebase, or domain.

**Characteristics:**

- Small (1-3 sentences ideal)
- Self-contained (understandable without deep context)
- Tagged for discovery
- Timestamped for freshness
- Confidence-scored (agent's certainty)

**Examples:**

- "This project uses Bun runtime, not Node.js"
- "User prefers explicit error messages over generic ones"
- "The main entry point is src/main.ts"
- "API responses are always wrapped in { data, error } shape"

**Anti-patterns (what NOT to store as facts):**

- Long explanations (use skills instead)
- File contents (use resources instead)
- Temporary debugging info

### Resources

References to external content with cached snapshots and retrieval methods.

**Components:**

- **URI** - Location (file path, URL, etc.)
- **Type** - file, url, api, command-output
- **Snapshot** - Cached content at last retrieval
- **Retrieval method** - How to refresh (command, fetch, etc.)
- **Content hash** - For staleness detection
- **Tags** - For discovery

**Why snapshots matter:** Instead of: "Read the file at X" Store: "Content of X" + "How to refresh X"

This eliminates redundant I/O while maintaining freshness awareness.

**Examples:**

- Documentation URL + rendered markdown snapshot
- Config file path + content + `cat` command
- API schema + JSON + fetch instructions

### Skills

Markdown-based knowledge documents that capture procedural understanding.

**Location:** `.github/prompts/skills/` (project-scoped, version-controlled)

**Characteristics:**

- Human-readable markdown
- Self-updating based on learning
- Searchable via SQL counterpart
- Hierarchical (can reference other skills)

**Structure:**

```
skills/
  project-patterns.md      # High-level architecture understanding
  testing-approach.md      # How to write tests for this project
  api-conventions.md       # API design patterns used
  error-handling.md        # Error handling strategies
  deployment.md            # Deployment procedures
```

**Why markdown + SQL?**

- Markdown: Readable by humans, injectable into prompts
- SQL: Searchable by tags, filterable by recency/relevance

**Self-updating behavior:** When an agent learns something through:

- User correction
- Trial and error
- Documentation reading
- Code exploration

...the relevant skill file should be updated with the new understanding.

### Tags

Cross-cutting categorization system enabling discovery across all entity types.

**Properties:**

- Name (unique identifier)
- Description (what this tag represents)
- Usage count (for relevance sorting)

**Usage patterns:**

- Filter facts by topic: `database`, `api`, `testing`
- Group resources by domain: `docs`, `config`, `schemas`
- Categorize skills by area: `setup`, `debugging`, `patterns`

**Tag hygiene:**

- Prefer existing tags over creating new ones
- Use hierarchical naming: `testing`, `testing:unit`, `testing:e2e`
- Periodic cleanup of unused tags

## Advanced Concepts

### Relevance Scoring

Not all context is equally useful. Relevance factors:

1. **Recency** - Recent facts may be more accurate
1. **Usage frequency** - Oft-retrieved facts are valuable
1. **Confidence** - Agent's certainty when creating
1. **Freshness** - Resource staleness since last verification
1. **Tag match strength** - Exact vs partial tag matches

**Ordering Options:** Search operations support `orderBy` parameter:

- Facts: `recent`, `oldest`, `usage` (by retrieval count)
- Resources: `recent`, `oldest`, `fresh` (by lastVerifiedAt)
- Skills: `recent`, `oldest`, `name` (alphabetical)
- Tags: `usage`, `name`, `recent`

### Context Reconstruction

The ability to rebuild working context from stored knowledge.

**Process:**

1. Identify task domain (via user query or explicit tags)
1. Retrieve relevant tags
1. Fetch facts matching tags (ordered by relevance)
1. Fetch resources matching tags
1. Inject relevant skills as system context
1. Present as compact text list

**Token efficiency:** Facts format: `- [tag1,tag2] fact content here` Resources format:
`- [type:tag] uri (snapshot_preview...)`

### Session Continuity

Tracking what was learned/used in a session for future reference.

**Captured:**

- Which facts were retrieved and useful
- What new facts were discovered
- Resources that were accessed
- Skills that were applied or updated

**Purpose:**

- Improve relevance scoring over time
- Identify knowledge gaps
- Track context evolution

### Staleness Detection

Knowing when cached knowledge may be outdated.

**Mechanisms:**

- Content hash comparison (for resources)
- Timestamp thresholds (configurable via `staleDays` or `staleHours`)
- Configurable freshness thresholds (`freshnessThresholdHours` on resource retrieval)
- Explicit invalidation (user or agent marks as stale)
- Dependency tracking (skill depends on resource snapshot hash)

**Proactive Warnings:** The `knowledge_context` prompt includes staleness warnings by default, providing awareness
without requiring explicit maintenance calls.

## MCP Integration

Factsets operates as an MCP server, exposing tools for self-maintenance.

**Tool categories:**

1. **Fact management** - Submit, search, update, delete facts
1. **Resource management** - Add, refresh, search resources
1. **Skill management** - Create, update, search skills
1. **Tag management** - Create, list, search by tags
1. **Context reconstruction** - Build context for a topic

**Design principle:** Tools should be **bulk-friendly** - submitting 10 facts should be one call, not ten.

## Self-Teaching

The system includes prompts that teach agents how to use it effectively.

**Meta-skills stored:**

- When to create vs update facts
- How to choose appropriate tags
- When to snapshot vs re-fetch resources
- How to structure skill documents
- When to prune stale knowledge

These meta-skills bootstrap agent proficiency with the system itself.

## Success Metrics

A well-functioning Factsets installation exhibits:

1. **Reduced re-explanation** - Users don't repeat context
1. **Faster task completion** - Relevant context readily available
1. **Improved accuracy** - Corrections persist
1. **Smaller prompts** - Targeted context, not kitchen sink
1. **Cross-session learning** - Agent improves over time
