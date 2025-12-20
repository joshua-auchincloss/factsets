# Adding a New MCP Tool to Factsets

## Overview

This skill describes how to add a new MCP tool to the factsets system.

## Steps

### 1. Define the Zod Schema

Create input validation in `src/schemas/`:

```typescript
import { z } from "zod";

export const myToolInput = z.object({
  requiredField: z.string().describe("Description for MCP clients"),
  optionalField: z.number().optional().describe("Optional parameter"),
});

export type MyToolInput = z.infer<typeof myToolInput>;
```

### 2. Create Database Operation

Add the operation in `src/db/operations/`:

```typescript
import type { DB } from "../index";
import type { MyToolInput } from "../../schemas/myTool";

export async function myOperation(db: DB, input: MyToolInput) {
  // Use Drizzle ORM for database operations
  // Return structured result
}
```

### 3. Register the Tool

In `src/tools/`, create or update the tool file:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../db/index";
import { myOperation } from "../db/operations/myTool";
import { myToolInput } from "../schemas/myTool";

export function registerMyTools(server: McpServer, db: DB) {
  server.registerTool(
    "my_tool_name",
    {
      description: "Clear description for MCP clients",
      inputSchema: myToolInput,
    },
    async (params) => {
      const result = await myOperation(db, params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
```

### 4. Wire Up in mcp-server.ts

Import and call the register function:

```typescript
import { registerMyTools } from "../tools/myTool";
// In mcpServerHandler:
registerMyTools(server, db);
```

### 5. Add Tests

Create integration test in `tests/mcp/tools.test.ts` using the test harness.

## Key Patterns

- Tool names use snake_case
- Descriptions should be clear for LLM clients
- Return JSON-serialized results
- Use Zod for validation with `.describe()` for documentation
