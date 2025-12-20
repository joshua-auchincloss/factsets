import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Read package.json to get dependencies that should be external
const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));

// Native modules that cannot be bundled
const nativeExternals = ["better-sqlite3", "libsql", "@libsql/client"];

await esbuild.build({
	entryPoints: [join(rootDir, "dist/main.js")],
	bundle: true,
	platform: "node",
	target: "node18",
	format: "esm",
	outfile: join(rootDir, "dist/main.js"),
	allowOverwrite: true,
	external: nativeExternals,
	banner: {
		js: `
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __bundleDirname } from 'path';
const __require = __createRequire(import.meta.url);
const __bundleFilename = __fileURLToPath(import.meta.url);
const __bundleDirPath = __bundleDirname(__bundleFilename);
`.trim(),
	},
	define: {
		"process.env.NODE_ENV": '"production"',
	},
	minify: false,
	sourcemap: false,
	treeShaking: true,
});

console.log("Bundle created successfully");
