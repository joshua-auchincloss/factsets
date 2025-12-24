---
name: staleness-management
title: "Managing Staleness in Factsets"
description: "How staleness detection and refresh cycles work"
tags: ["staleness", "maintenance", "factsets"]
updated: 2025-12-20
---

# Managing Staleness in Factsets

## Overview

Staleness detection helps agents know when their cached knowledge is outdated.

## What Gets Tracked

### Resources

- `snapshot`: Cached content
- `snapshot_hash`: Hash for comparison
- `last_verified_at`: When agent last confirmed freshness

### Skills

- `content_hash`: Hash of markdown content
- References to resources (via `skill_resources`)
- If referenced resource changes, skill is flagged

## Staleness Check Flow

```typescript
const result = await checkStale(db, {
  maxAgeHours: 168,
  checkResources: true,
  checkSkills: true,
  checkFacts: true,
});
```

Returns:

```typescript
{
  staleResources: [{
    id, uri, type, hoursStale, lastVerifiedAt,
    retrievalMethod  // Agent uses this to refresh
  }],
  staleSkills: [{
    name, reason, staleDependencies: [{ type, name }]
  }],
  unverifiedFacts: [{
    id, content, hoursOld, sourceType
  }],
  summary: { resources, skills, facts, totalStale }
}
```

## Refresh Workflow

1. Call `check_stale` tool
1. For each stale resource:
   - Use `retrievalMethod` to fetch fresh content
   - Call `update_resource_snapshot` with new content
1. For skills with stale deps:
   - Review and update skill content
   - Call `mark_resources_refreshed`

## Retrieval Methods

```json
// File resource
{ "type": "file" }

// URL resource
{ "type": "url", "url": "https://example.com/data" }

// API with auth
{ "type": "api", "url": "...", "headers": { "Authorization": "..." } }

// Command execution
{ "type": "command", "command": "cat /etc/config" }
```

## Maintenance Prompt

Use the `maintenance_report` prompt for a formatted overview:

```typescript
await server.getPrompt("maintenance_report", { maxAgeHours: "168" });
```

Returns markdown with actionable sections for stale items.
