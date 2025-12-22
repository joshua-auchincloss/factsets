---
name: run-tests-build
title: "Running Factsets Tests and Build"
description: "Commands and patterns for running Factsets tests and builds, including test structure, expected results, and debugging tips."
tags: ["factsets", "testing", "build", "commands"]
updated: 2025-12-21
---
# Running Factsets Tests and Build

## Quick Commands

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Build TypeScript
bun run build

# Full distribution build
bun run dist

# Run both tests and build (validation)
bun test && bun run build
```

## Test Structure

Tests are organized by domain:

- `tests/operations/` - Database operation tests (facts, resources, skills, tags, staleness)
- `tests/mcp/` - MCP tool and prompt integration tests
- `tests/workflows/` - End-to-end workflow tests
- `tests/utils/` - Utility function tests

## Test Utilities

The test harness (`tests/harness.ts`) provides:

- `createTestDb()` - In-memory SQLite database for fast unit tests
- `createTestServer()` - MCP subprocess client for integration tests
- `seedTestData()` - Pre-populated test data for workflow tests

## Expected Results

- 290+ tests should pass
- 559+ expect() calls
- TypeScript compilation should succeed with no errors

## Debugging Failed Tests

```bash
# Run specific test file
bun test tests/operations/facts.test.ts

# Run tests matching pattern
bun test --grep "submit_facts"

# Run with verbose output
bun test --verbose
```

## CI/CD

Tests run automatically on:
- Pull requests via GitHub Actions
- Push to main branch
- Release workflow
