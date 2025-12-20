# Working with Drizzle in Factsets

## Overview

Factsets uses Drizzle ORM with SQLite for all database operations. This skill covers common patterns.

## Database Connection

The database is created in `src/db/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

export function createConnection(url: string) {
  return drizzle({ schema , connection: { url }});
}

export type DB = ReturnType<typeof createConnection>;
```

## Schema Patterns

### Many-to-Many with Junction Tables

```typescript
export const factTags = sqliteTable(
  "fact_tags",
  {
    factId: integer("fact_id").notNull().references(() => facts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.factId, table.tagId] })]
);
```

### Relations for Query Builder

```typescript
export const factsRelations = relations(facts, ({ many }) => ({
  factTags: many(factTags),
}));
```

## Bulk Insert with Conflict Handling

```typescript
// Insert many, skip duplicates
await db.insert(tags)
  .values(tagValues)
  .onConflictDoNothing();

// Insert or update
await db.insert(resources)
  .values(resourceValues)
  .onConflictDoUpdate({
    target: resources.uri,
    set: { snapshot: sql`excluded.snapshot` }
  });
```

## Querying with Relations

```typescript
const result = await db.query.facts.findMany({
  where: (f, { eq }) => eq(f.verified, true),
  with: {
    factTags: {
      with: { tag: true }
    }
  },
  limit: 20,
});
```

## Migrations

Generate migrations after schema changes:

```bash
bunx drizzle-kit generate
```

Migrations are stored in `drizzle/` and applied automatically on startup.

## Testing Pattern

Use in-memory SQLite for tests:

```typescript
const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "./drizzle" });
```
