---
name: database-schema-migration
title: "Database Schema Migration with Drizzle"
description: "How to update the Factsets database schema using Drizzle ORM migrations"
tags: ["database", "drizzle", "migration", "schema", "factsets"]
updated: 2025-12-21
---
# Database Schema Migration with Drizzle

This skill documents how to update the Factsets database schema using Drizzle ORM.

## Prerequisites

- Drizzle ORM configured in the project
- Schema defined in `src/db/schema.ts`
- Drizzle config at `drizzle.config.ts`

## Workflow

### 1. Modify Schema

Edit `src/db/schema.ts` to add, remove, or modify columns/tables.

**Example: Adding a new column with default**
```typescript
description: text("description")
  .default("[auto-migrated] Needs description")
  .notNull(),
```

### 2. Generate Migration

Run the following command to generate a migration:

```bash
bun drizzle-kit generate
```

This creates a new migration folder in `src/db/migrations/` with:
- `migration.sql` - The SQL statements
- `snapshot.json` - Schema snapshot for tracking

### 3. Review Migration

Always review the generated SQL to ensure it:
- Uses proper defaults for NOT NULL columns
- Handles existing data appropriately
- Includes necessary indexes

### 4. Apply Migration

Migrations are automatically applied when the server starts via `runMigrations()`.

For in-memory test databases, migrations run in order from the `db/migrations` folder.

## Best Practices

1. **Never delete existing migrations** - Only add new ones
2. **Use sensible defaults** - For new NOT NULL columns, use `.default()` to handle existing rows
3. **Test locally first** - Run `bun test` after generating migrations
4. **Keep migrations atomic** - One logical change per migration

## Common Patterns

### Adding a required column to existing table
```typescript
newColumn: text("new_column")
  .default("[auto-migrated] Needs value")
  .notNull(),
```

### Making optional column required
Generate a migration that sets defaults, then update schema to .notNull()

## Troubleshooting

- **"no such table"** - Check migration order and that initial migration creates tables
- **"no such column"** - Run `bun drizzle-kit generate` to create migration
- **Test failures after schema change** - Update test factories and harness with new required fields
