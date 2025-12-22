---
name: adding-preferences
title: "Adding New Preferences to Factsets"
description: "How to add new user preferences to the Factsets configuration system, including all files to modify and naming conventions."
tags: ["factsets", "development", "preferences", "configuration"]
updated: 2025-12-22
---
# Adding New Preferences to Factsets

## Overview

This documents the process for adding new user preferences to Factsets. Preferences control agent output behavior and are stored in the configuration system.

## Files to Modify

When adding a new preference, update these files in order:

### 1. src/runtime/types.ts

Add type definition for the new preference:

```typescript
export type PreferenceNewOption =
	| "value1"
	| "value2"
	| "value3";
```

Add field to `UserPreferencesConfig` interface:

```typescript
export interface UserPreferencesConfig {
	// ... existing fields
	/** Description of what this preference controls */
	newOption: PreferenceNewOption;
}
```

### 2. src/runtime/defaults.ts

Add default value in `DEFAULT_USER_PREFERENCES`:

```typescript
export const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
	// ... existing defaults
	newOption: "value1",
};
```

Add config schema entry in `CONFIG_SCHEMA`:

```typescript
pref_new_option: {
	description: "Human-readable description of the preference",
	type: "string" as const,
	values: ["value1", "value2", "value3"],
	default: DEFAULT_USER_PREFERENCES.newOption,
	category: "preferences" as const,
},
```

### 3. src/tools/preferences.ts

Add special handling for banned/omit values if applicable:

```typescript
if (value === "banned") {
	if (key === "pref_new_option") {
		return "User BANS new option - description of what this means";
	}
}
```

Add description mapping for all values:

```typescript
pref_new_option: {
	value1: "User prefers value1 behavior",
	value2: "User prefers value2 behavior",
	value3: "User prefers value3 behavior",
},
```

Add to categories array in `generatePreferencePrompt`:

```typescript
const categories = {
	// ... existing categories
	code: ["...", "pref_new_option", "..."],
};
```

### 4. Documentation Files

Update these docs:
- docs/config.md - Add to appropriate table
- src/prompts/config.md - Same as above (keep in sync)
- docs/facts-agent-flow.md - Update example keys if relevant
- src/prompts/facts-agent-flow.md - Keep in sync
- docs/design.md - Update preference reference table

### 5. Skills

Update user-preferences-guide.md skill if the preference is commonly used.

## Naming Conventions

- Type name: `Preference{PascalCaseName}` (e.g., `PreferenceCodeInlineComments`)
- Config key: `pref_{snake_case_name}` (e.g., `pref_code_inline_comments`)
- Field name: `{camelCaseName}` (e.g., `codeInlineComments`)

## Value Conventions

Standard value meanings:
- `banned` - Strictly prohibited, never use
- `omit` - Do not include at all
- `minimal` - Use sparingly, only when essential
- `moderate` - Balanced usage
- `verbose` / `comprehensive` - Use liberally

## Testing

Run `bun test` after changes to verify type consistency across the codebase.

## Sync Note

Files docs/*.md and src/prompts/*.md should stay synchronized. The prompts/ versions are used by the MCP server at runtime.
