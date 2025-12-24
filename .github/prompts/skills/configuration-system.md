---
name: configuration-system
title: "Factsets Configuration System"
description: "Complete guide to the Factsets configuration system including all 30+ configurable keys, categories, helper functions, and runtime configuration management."
tags: ["factsets", "config", "config-expansion", "reference", "documentation"]
updated: 2025-12-21
---

# Factsets Configuration System

## Overview

Factsets v0.1.3 introduces a comprehensive configuration system with 30+ configurable keys organized into logical categories. Configuration values are stored in the database and accessed via MCP tools.

## Configuration Categories

### 1. Freshness Thresholds

Control how long resources remain fresh by category:

| Category       | Config Key                            | Default (hours) | Use Case                       |
| -------------- | ------------------------------------- | --------------- | ------------------------------ |
| Source Code    | `freshness_threshold_source_code`     | 12              | Frequently changing code files |
| Lock Files     | `freshness_threshold_lock_files`      | 168 (1 week)    | Stable dependency locks        |
| Config Files   | `freshness_threshold_config_files`    | 24              | Project configuration          |
| Documentation  | `freshness_threshold_documentation`   | 72 (3 days)     | README, guides                 |
| Generated      | `freshness_threshold_generated_files` | 1               | Build outputs, caches          |
| API Schemas    | `freshness_threshold_api_schemas`     | 24              | OpenAPI, GraphQL schemas       |
| Database       | `freshness_threshold_database`        | 72 (3 days)     | Migrations, seeds              |
| Scripts        | `freshness_threshold_scripts`         | 72 (3 days)     | Build/deploy scripts           |
| Tests          | `freshness_threshold_tests`           | 24              | Test files                     |
| Assets         | `freshness_threshold_assets`          | 168 (1 week)    | Images, fonts                  |
| Infrastructure | `freshness_threshold_infrastructure`  | 24              | Docker, CI/CD configs          |
| Default        | `freshness_threshold_default`         | 168 (1 week)    | Uncategorized                  |

### 2. Search Limits

Default limits for search operations:

| Config Key               | Default | Description            |
| ------------------------ | ------- | ---------------------- |
| `search_limit_facts`     | 50      | Max facts returned     |
| `search_limit_resources` | 100     | Max resources returned |
| `search_limit_skills`    | 30      | Max skills returned    |
| `search_limit_tags`      | 100     | Max tags returned      |

### 3. Context Budgets

Token limits for `get_knowledge_context` output:

| Config Key                 | Default | Description                   |
| -------------------------- | ------- | ----------------------------- |
| `context_budget_facts`     | 10000   | Token limit for facts section |
| `context_budget_resources` | 5000    | Token limit for resources     |
| `context_budget_skills`    | 5000    | Token limit for skills        |

Tokens are estimated at 4 characters per token.

### 4. Tag Relationships

Enable automatic tag expansion and validation:

| Config Key                       | Type        | Default | Description                                            |
| -------------------------------- | ----------- | ------- | ------------------------------------------------------ |
| `tag_synonyms`                   | JSON object | `{}`    | Maps alias → canonical (e.g., `{"py": "python"}`)      |
| `tag_hierarchy`                  | JSON object | `{}`    | Parent → children (e.g., `{"frontend": ["js", "ts"]}`) |
| `required_tags`                  | JSON array  | `[]`    | Tags required on all submissions                       |
| `tag_expansion_search_facts`     | boolean     | `true`  | Expand tags in fact searches                           |
| `tag_expansion_search_resources` | boolean     | `true`  | Expand tags in resource searches                       |
| `tag_expansion_search_skills`    | boolean     | `true`  | Expand tags in skill searches                          |

### 5. Snapshot Management

Control resource snapshot handling:

| Config Key           | Default | Description                                |
| -------------------- | ------- | ------------------------------------------ |
| `snapshot_max_bytes` | 100000  | Max snapshot size before overflow handling |

Overflow behaviors (per-resource via `overflowBehavior` parameter):

- `truncate` - Hard cut at limit
- `remove_noise` - Apply regex patterns to remove boilerplate
- `html_to_md` - Convert HTML to markdown using Turndown
- `ignore` - Skip size limit entirely

### 6. Staleness & Maintenance

| Config Key                          | Default | Description                                     |
| ----------------------------------- | ------- | ----------------------------------------------- |
| `staleness_warning_threshold`       | 0.8     | Percent of freshness before "approaching stale" |
| `staleness_check_max_age_hours`     | 168     | Hours for staleness check                       |
| `maintenance_max_skills_display`    | 10      | Max skills in maintenance report                |
| `maintenance_max_resources_display` | 20      | Max resources in maintenance report             |

### 7. Worker Intervals

Background worker task schedules (milliseconds):

| Config Key                           | Default         | Description                 |
| ------------------------------------ | --------------- | --------------------------- |
| `worker_interval_staleness_check`    | 3600000 (1hr)   | Staleness scan interval     |
| `worker_interval_orphan_prune`       | 86400000 (24hr) | Orphan tag cleanup interval |
| `worker_interval_unverified_cleanup` | 604800000 (1wk) | Old unverified fact cleanup |

## Reading Configuration

```
// Via MCP tool
get_config key="tag_synonyms"

// Get full schema
get_config_schema

// List all current values
list_config
```

## Setting Configuration

```
// Single value
set_config key="staleness_warning_threshold" value="0.75"

// JSON value (arrays, objects)
set_config key="tag_synonyms" value='{"py":"python","js":"javascript"}'

// Reset to default
delete_config key="staleness_warning_threshold"
```

## Helper Functions (Internal)

The runtime provides typed helpers:

- `getConfigNumber(db, key)` - Returns number or throws
- `getConfigArray(db, key)` - Parses JSON array
- `getConfigObject(db, key)` - Parses JSON object
- `getStalenessWarningThreshold(db)` - Staleness threshold with validation
- `expandTagsWithSynonyms(db, tags)` - Apply synonym expansion
- `expandTagsWithHierarchy(db, tags)` - Apply hierarchy expansion
- `validateRequiredTags(db, tags)` - Check required tags

## Best Practices

1. **Start with defaults** - Only customize what you need
2. **Use tag synonyms** for consistent categorization across teams
3. **Set tag hierarchy** for domain-specific organization
4. **Lower freshness thresholds** for volatile projects
5. **Enable required_tags** to enforce organizational standards
6. **Monitor approaching-stale** warnings before resources become fully stale

## References

- [docs/config.md](docs/config.md) - User-facing config documentation
- [src/runtime/config.ts](src/runtime/config.ts) - CONFIG_SCHEMA source
- [docs/design.md](docs/design.md) - API reference
