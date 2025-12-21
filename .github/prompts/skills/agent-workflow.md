---
name: agent-workflow
title: "Factsets Agent Workflow Guide"
description: "MANDATORY workflow for AI agents using Factsets. Defines automatic triggers for knowledge capture: session start, URL fetches, research, commands, procedures. Includes self-check questions and anti-patterns."
tags: ["factsets", "workflow", "agent", "mandatory", "best-practices"]
updated: 2025-12-20
---
# Factsets Agent Workflow

## MANDATORY: Always-On Knowledge Management

**Factsets is not optional.** The following behaviors are REQUIRED in every session without user prompting:

### Automatic Triggers (No User Prompt Needed)

| Trigger | Action | Tool |
|---------|--------|------|
| **Session start** | Check existing knowledge | `list_tags`, `search_facts` |
| **Research task** | Store findings immediately | `submit_facts`, `add_resources` |
| **Fetch any URL** | Register as resource | `add_resources` with URL |
| **Learn new information** | Capture as facts | `submit_facts` |
| **Run successful command** | Log execution | `submit_execution_logs` |
| **Before creating skill** | Check for existing skill | `search_skills` by name or tags |
| **Create procedure** | Document as skill | `create_skill` (only if no match found) |
| **Complete multi-step task** | Summarize learnings | `submit_facts` |
| **See placeholder description** | Fix with real description | `update_resource_snapshot` / `update_skill` |

### Self-Check Questions (Before Ending ANY Task)

1. Did I learn something new? → `submit_facts`
2. Did I fetch external content? → `add_resources`
3. Did I run commands that worked? → `submit_execution_logs`
4. Did I discover a reusable procedure? → `create_skill`
5. Is there existing knowledge I should have checked? → `search_facts`, `search_skills`

### The Golden Rule

> **If information is valuable enough to tell the user, it's valuable enough to store in Factsets.**

## Workflow Phases

1. **Discover** - `list_tags` at session start, `search_skills` for domain
2. **Retrieve** - `get_skill` / `build_skill_context` for procedures
3. **Execute** - Perform task, log commands with `submit_execution_logs`
4. **Contribute** - `create_skill` (link execution log!) / `submit_facts`
5. **Maintain** - `check_stale` periodically (not every session)

## Anti-Patterns (Never Do These)

| Anti-Pattern | Why It's Wrong | Correct Behavior |
|--------------|----------------|------------------|
| Fetching URLs without `add_resources` | Knowledge is lost | Always register URLs |
| Research without `submit_facts` | Findings disappear | Capture key learnings |
| Commands succeed without logging | Memory lost | `submit_execution_logs` |
| Waiting for user to say "save this" | Reactive, not proactive | Capture automatically |
| Creating docs but not skills | Not searchable | Use `create_skill` |
| Not checking existing knowledge | Reinventing wheel | Search first |
| Creating skill without checking | Creates duplicates | `search_skills` first, update or create |
| Leaving placeholder descriptions | Knowledge is degraded | Fix `[auto-migrated]` / `[auto-generated]` |

## Placeholder Descriptions

Resources and skills may have auto-generated placeholder descriptions:

- `[auto-migrated] Needs description`
- `[auto-generated] Needs description`

When you encounter these in search results or maintenance reports:

1. Read the resource content or skill file to understand its purpose
2. Write a concise, meaningful description (1-2 sentences)
3. Update using `update_resource_snapshot` or `update_skill`

Do not leave placeholder descriptions. Fix them as you encounter them.

**If you find yourself NOT using Factsets during research, learning, or execution - you are doing it wrong.**
