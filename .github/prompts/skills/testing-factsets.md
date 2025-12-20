---
name: testing-factsets
title: "Testing Factsets"
description: "Guide to writing and running tests for factsets"
tags: ["testing", "factsets", "best-practices"]
updated: 2025-12-20
---
# Testing Factsets

## Overview

Factsets uses Bun's built-in test framework with two testing approaches:

1. **Workflow tests** - Direct database operations with in-memory SQLite
1. **MCP integration tests** - Full server via subprocess with stdio transport

## Test Harness

The test harness in `tests/harness.ts` provides:

### In-Memory Database

```typescript
import { createConnection, runMigrations } from "../src/db";

export async function createTestDb() {
  const db = createConnection(":memory:");
  await runMigrations(db);
  return db;
}
```

### MCP Client for Integration Tests

```typescript
export async function createTestServer() {
  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  });

  await client.connect(
    new StdioClientTransport({
      command: "bun",
      args: ["src/main.ts", "mcp-server", "--database-url", "sqlite://:memory:"]
    }),
  );

  return {
    client,
    callTool: async (name, params) => client.callTool({ name, arguments: params }),
    getPrompt: async (name, params) => client.getPrompt({ name, arguments: params }),
  };
}
```

## Workflow Test Pattern

Test database operations directly:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";

describe("my workflow", () => {
  let db: TestDB;

  beforeEach(() => {
    db = createTestDb();
  });

  it("does something", async () => {
    const result = await myOperation(db, { input: "value" });
    expect(result.count).toBe(1);
  });
});
```

## MCP Integration Test Pattern

Test tools and prompts via MCP protocol:

```typescript
describe("mcp tools", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await createTestServer();
  });

  it("calls tool successfully", async () => {
    const result = await server.callTool("submit_facts", {
      facts: [{ content: "Test", tags: ["test"] }],
    });
    expect(result.isError).toBeFalsy();
  });
});
```

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/mcp/tools.test.ts

# Run with pattern
bun test --filter "workflow"
```

## Key Considerations

- Each test gets fresh in-memory database
- MCP tests spawn subprocess per test (slower but realistic)
- Use `resetFactories()` between tests if using factories
- Prompts use string parameters (comma-separated for arrays)
