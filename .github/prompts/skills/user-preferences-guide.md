---
name: user-preferences-guide
title: "User Preferences Guide"
description: "How to work with user preferences for response generation, code output, and documentation formatting."
tags: ["factsets", "user-preferences", "agent-workflow", "best-practices"]
updated: 2025-12-22
---
# User Preferences Guide

## Overview

User preferences control how agents generate all output: responses, code, and documentation. Always check preferences before generating content.

## Quick Reference

### Check Preferences Before Output

```json
// Get natural language prompt for context
{ "tool": "get_preference_prompt" }

// Or get structured data
{ "tool": "get_user_preferences" }
```

### Key Terminology

- **banned**: Strictly prohibited - never use under any circumstances
- **omit**: Do not include at all
- **avoid**: Try not to use unless necessary
- **skip**: Proceed without asking/doing

### Default Behavior

The defaults optimize for token efficiency:
- `pref_emoji_usage: banned` - No emojis ever
- `pref_special_chars: banned` - No decorative unicode
- `pref_verbosity: concise` - No unnecessary words
- `pref_code_comments: minimal` - Few inline comments
- `pref_code_inline_comments: critical` - Comments only for critical code
- `pref_summary_position: omit` - No TL;DR sections

## Inferring Preferences

When user expresses a preference, update it:

```json
// Explicit statement: "I want more code comments"
{
  "tool": "infer_preference",
  "key": "pref_code_comments",
  "value": "verbose",
  "reason": "User explicitly requested more comments",
  "confidence": 1.0,
  "explicit": true
}

// Inferred from behavior (user keeps editing out emojis)
{
  "tool": "infer_preference",
  "key": "pref_emoji_usage",
  "value": "banned",
  "reason": "User consistently removes emojis from responses",
  "confidence": 0.9,
  "explicit": false
}
```

### Inference Rules

1. **Explicit preferences always apply**
2. **Inferred preferences need confidence >= 0.8**
3. **Never override explicit user settings with inference**

## Common Patterns

### Token-Efficient Output
```
pref_verbosity: minimal
pref_summary_position: omit
pref_code_block_context: omit
pref_suggestions: omit
```

### Detailed Explanations
```
pref_verbosity: detailed
pref_code_block_context: full
pref_docs_technical_depth: expert
pref_docs_examples: comprehensive
```

### Minimal Interaction
```
pref_confirmations: skip
pref_questions: avoid
pref_suggestions: omit
pref_progress_updates: false
```

### Clean Code Output
```
pref_code_comments: banned
pref_code_inline_comments: banned
pref_code_docstrings: omit
pref_code_type_annotations: explicit
pref_code_imports_style: grouped
```

## Best Practices
CONFIG_SCHEMA
1. **Call get_preference_prompt at session start** - Include in context
2. **Watch for preference signals** - "be more concise", "add comments", etc.
3. **Update immediately when user expresses preference** - Don't wait
4. **Respect banned values absolutely** - Never include banned elements
5. **Check code preferences before generating code** - Comments, types, style
