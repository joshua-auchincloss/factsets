import { cpSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Ensure destination directories exist
mkdirSync(join(rootDir, "dist/db"), { recursive: true });
mkdirSync(join(rootDir, "dist/prompts"), { recursive: true });

// Copy migrations (recursive, follow symlinks)
cpSync(
	join(rootDir, "src/db/migrations"),
	join(rootDir, "dist/db/migrations"),
	{ recursive: true, dereference: true },
);

// Copy prompts
cpSync(join(rootDir, "src/prompts"), join(rootDir, "dist/prompts"), {
	recursive: true,
	dereference: true,
	filter: (src) => src.endsWith(".md") || !src.includes("."),
});

console.log("Assets copied successfully");
