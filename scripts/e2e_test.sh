#!/bin/bash

set -ex

# E2E test: simulates installing the package from npm and running it

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR=$(mktemp -d)

echo "==> Running tests..."
cd "$ROOT_DIR"
bun test --timeout 600000

echo "==> Building distribution..."
bun run dist

echo "==> Packing package..."
TARBALL=$(npm pack --pack-destination "$TEST_DIR" 2>&1 | tail -1)
echo "Tarball: $TARBALL"

echo "==> Installing package in test directory..."
cd "$TEST_DIR"
npm init -y
npm install "./$TARBALL"

echo "==> Running CLI dry-run..."
./node_modules/.bin/factsets mcp-server --dry

echo "==> Cleaning up..."
rm -rf "$TEST_DIR"

echo "==> E2E test passed!"
