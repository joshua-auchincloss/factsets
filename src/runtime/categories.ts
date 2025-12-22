import type { FreshnessCategory, CategoryMatchRule } from "./types.js";

/**
 * Match a clause against a URI (first pass - URI-based matching only).
 * Returns true if:
 * 1. (ANY endsWith matches OR ANY includes matches) - at least one positive match
 * 2. AND NOT (ANY not.endsWith matches OR ANY not.includes matches)
 *
 * Note: not.tagged is NOT checked here - it's handled in a second pass
 * after all URI-based matches are collected.
 */
const matchClauseUri = (clause: CategoryMatchRule, uri: string): boolean => {
	const { endsWith = [], includes = [], not } = clause;

	// Check URI-based negative conditions first (fail fast)
	if (not) {
		// If any not.endsWith pattern matches, fail
		if (not.endsWith?.some((ext) => uri.endsWith(ext))) {
			return false;
		}
		// If any not.includes pattern matches, fail
		if (not.includes?.some((str) => uri.includes(str))) {
			return false;
		}
		// not.tagged is intentionally NOT checked here - see second pass
	}

	// Need at least one positive match (any endsWith OR any includes)
	const hasPositiveRules = endsWith.length > 0 || includes.length > 0;
	if (!hasPositiveRules) {
		// No positive rules means this is a catch-all (like 'default')
		return true;
	}

	const endsWithMatch = endsWith.some((ext) => uri.endsWith(ext));
	const includesMatch = includes.some((str) => uri.includes(str));

	return endsWithMatch || includesMatch;
};

/**
 * Check if a category should be excluded based on not.tagged rules.
 * This is the second pass - called after all URI-based matches are collected.
 * A category is excluded if ANY of its not.tagged categories are in the matched set.
 */
const shouldExcludeByTag = (
	clause: CategoryMatchRule,
	matchedCategories: Set<FreshnessCategory>,
): boolean => {
	if (!clause.not?.tagged || clause.not.tagged.length === 0) {
		return false;
	}
	return clause.not.tagged.some((tag) => matchedCategories.has(tag));
};

/**
 * Category matching rules for each freshness category.
 * Order matters for priority - more specific categories should be checked first.
 */
export const CATEGORY_RULES: { [key in FreshnessCategory]: CategoryMatchRule } =
	{
		// Lock files - exact matches and patterns for package manager locks
		// High priority - check before configFiles since .lock could match .json patterns
		lockFiles: {
			endsWith: [".lock", ".lockb"],
			includes: [
				"package-lock.json",
				"yarn.lock",
				"pnpm-lock.yaml",
				"bun.lockb",
				"bun.lock",
				"gemfile.lock",
				"pipfile.lock",
				"poetry.lock",
				"cargo.lock",
				"go.sum",
				"composer.lock",
				"podfile.lock",
				"pubspec.lock",
				"mix.lock",
				"flake.lock",
				"packages.lock.json",
				"shrinkwrap.json",
			],
		},

		// Database files - SQL, migrations, seeds, ORM schemas
		// Check before sourceCode to catch .sql files
		database: {
			endsWith: [".sql", ".sqlite", ".sqlite3", ".db", ".prisma", ".dump"],
			includes: [
				"/migrations/",
				"/db/migrations/",
				"/database/migrations/",
				"/prisma/migrations/",
				"/drizzle/",
				"/seeds/",
				"/seeders/",
				"/fixtures/",
				"/sql/",
				"schema.prisma",
			],
			not: {
				// Exclude test fixtures from database category
				includes: ["__fixtures__", "__mocks__", "/test", "/spec"],
			},
		},

		// Test files - test patterns across ecosystems
		// Check before sourceCode to properly categorize test files
		tests: {
			endsWith: [
				".test.ts",
				".test.js",
				".test.tsx",
				".test.jsx",
				".test.mjs",
				".test.cjs",
				".spec.ts",
				".spec.js",
				".spec.tsx",
				".spec.jsx",
				".spec.mjs",
				".spec.cjs",
				"_test.py",
				"_test.go",
				"_test.rb",
				"_spec.rb",
			],
			includes: [
				"test_", // Python test_ prefix
				"/__tests__/",
				"/test/",
				"/tests/",
				"/spec/",
				"/__mocks__/",
				"/__fixtures__/",
				"/testdata/",
				"/testing/",
				"/fixtures/",
				"conftest.py",
				".snap", // Jest snapshots
			],
		},

		// Infrastructure - Terraform, K8s, Docker, CI/CD
		// Check before configFiles since many use .yaml/.yml
		infrastructure: {
			endsWith: [".tf", ".tfvars", ".hcl"],
			includes: [
				// Docker
				"dockerfile",
				"docker-compose",
				"compose.yaml",
				"compose.yml",
				".dockerignore",
				// Kubernetes
				"/k8s/",
				"/kubernetes/",
				"/manifests/",
				"/charts/",
				"chart.yaml",
				"values.yaml",
				"values-",
				"kustomization.yaml",
				// CI/CD
				".github/workflows/",
				".gitlab-ci",
				".circleci/",
				".buildkite/",
				"jenkinsfile",
				".travis.yml",
				"azure-pipelines",
				"bitbucket-pipelines",
				".drone.yml",
				// Ansible
				"/playbooks/",
				"/roles/",
				"ansible.cfg",
				"inventory",
				// Terraform
				"/terraform/",
			],
		},

		// API schemas - OpenAPI, GraphQL, Protocol Buffers
		// Be conservative - avoid generic patterns like "schema" or "/api/"
		apiSchemas: {
			endsWith: [
				".graphql",
				".gql",
				".proto",
				".thrift",
				".wsdl",
				".raml",
				".xsd",
				".openapi.yaml",
				".openapi.json",
				".swagger.yaml",
				".swagger.json",
				".asyncapi.yaml",
				".asyncapi.json",
			],
			includes: [
				"/graphql/",
				"/proto/",
				"/protos/",
				"/idl/",
				"/contracts/",
				"openapi.yaml",
				"openapi.json",
				"swagger.yaml",
				"swagger.json",
				// Note: NOT including generic "schema" - too ambiguous
			],
			not: {
				// Exclude database schema files
				includes: ["prisma", "drizzle", "/migrations/", "/db/"],
			},
		},

		// Scripts - shell scripts, makefiles, build helpers
		// Check before sourceCode to catch .sh, .bash, etc. as scripts not source
		scripts: {
			endsWith: [
				".sh",
				".bash",
				".zsh",
				".fish",
				".ps1",
				".psm1",
				".psd1",
				".bat",
				".cmd",
				".awk",
				".sed",
				".mk",
			],
			includes: [
				"/scripts/",
				"/bin/",
				"/tools/",
				"/hack/",
				"/build-scripts/",
				"/devtools/",
				".husky/",
				"makefile",
				"gnumakefile",
				"justfile",
				"taskfile",
				"rakefile",
				"jakefile",
			],
		},

		// Generated files - build outputs, compiled code, minified assets
		// Note: No not.tagged exclusions - sourceCode already excludes generatedFiles
		generatedFiles: {
			endsWith: [
				".min.js",
				".min.css",
				".min.html",
				".bundle.js",
				".bundle.css",
				".map",
				".js.map",
				".css.map",
				".pyc",
				".pyo",
				".class",
				".o",
				".obj",
				".so",
				".dylib",
				".dll",
				".pb.go",
				".pb.js",
				".pb.ts",
			],
			includes: [
				"/dist/",
				"/build/",
				"/out/",
				"/output/",
				"/target/",
				"/node_modules/",
				"/__pycache__/",
				"/.pytest_cache/",
				"/coverage/",
				"/.next/",
				"/.nuxt/",
				"/.svelte-kit/",
				"/.vercel/",
				"/.netlify/",
				"/.gradle/",
				"_generated.",
				".gen.",
				".auto.",
			],
		},

		// Assets - images, fonts, media files
		assets: {
			endsWith: [
				// Images
				".png",
				".jpg",
				".jpeg",
				".gif",
				".svg",
				".ico",
				".icns",
				".webp",
				".avif",
				".bmp",
				".tiff",
				".tif",
				".psd",
				".ai",
				// Fonts
				".woff",
				".woff2",
				".ttf",
				".otf",
				".eot",
				// Audio
				".mp3",
				".wav",
				".ogg",
				".flac",
				".aac",
				// Video
				".mp4",
				".webm",
				".mov",
				".avi",
				".mkv",
				// Documents
				".pdf",
			],
			includes: [
				"/assets/",
				"/images/",
				"/img/",
				"/fonts/",
				"/media/",
				"/static/",
				"/public/",
			],
		},

		// Documentation - markdown, text docs
		documentation: {
			endsWith: [".md", ".markdown", ".mdx", ".rst", ".adoc", ".asciidoc"],
			includes: [
				"/docs/",
				"/doc/",
				"/documentation/",
				"readme",
				"changelog",
				"contributing",
				"license",
				"authors",
				"history",
				"news",
			],
		},

		// Config files - project and tool configuration
		// Lower priority - checked after more specific categories
		configFiles: {
			endsWith: [".toml", ".ini", ".cfg", ".conf", ".properties"],
			includes: [
				// Universal
				"/config/",
				"/configs/",
				"/.config/",
				".env",
				// JavaScript/TypeScript
				"package.json",
				"tsconfig",
				"jsconfig",
				".eslintrc",
				".prettierrc",
				"biome.json",
				".babelrc",
				"babel.config",
				"vite.config",
				"webpack.config",
				"rollup.config",
				"jest.config",
				"vitest.config",
				".npmrc",
				".yarnrc",
				"turbo.json",
				"nx.json",
				".editorconfig",
				// Python
				"pyproject.toml",
				"setup.py",
				"setup.cfg",
				"requirements.txt",
				"pipfile",
				"pytest.ini",
				"tox.ini",
				".flake8",
				"mypy.ini",
				// Ruby
				"gemfile",
				".rubocop",
				// Go
				"go.mod",
				// Rust
				"cargo.toml",
				"rustfmt.toml",
				// .NET
				".csproj",
				".sln",
				"nuget.config",
				"appsettings",
				// Java
				"pom.xml",
				"build.gradle",
				"settings.gradle",
				"gradle.properties",
				// PHP
				"composer.json",
				"phpunit.xml",
			],
			not: {
				tagged: ["lockFiles"],
			},
		},

		// Source code - programming language files
		// Lowest priority among code-related - let more specific categories match first
		sourceCode: {
			endsWith: [
				// JavaScript/TypeScript
				".ts",
				".tsx",
				".js",
				".jsx",
				".mjs",
				".cjs",
				".mts",
				".cts",
				// Python
				".py",
				".pyi",
				".pyx",
				".pxd",
				// Systems
				".rs",
				".go",
				".c",
				".cc",
				".cpp",
				".cxx",
				".h",
				".hpp",
				".hxx",
				// JVM
				".java",
				".kt",
				".kts",
				".scala",
				".groovy",
				".clj",
				".cljs",
				// .NET
				".cs",
				".fs",
				".vb",
				// Ruby
				".rb",
				".erb",
				// PHP
				".php",
				// Swift/Objective-C
				".swift",
				".m",
				".mm",
				// Functional
				".hs",
				".ml",
				".mli",
				".elm",
				".ex",
				".exs",
				".erl",
				".hrl",
				// Other
				".r",
				".R",
				".jl",
				".lua",
				".pl",
				".pm",
				".dart",
				".v",
				".vh",
				".sv",
				".vhd",
				".vhdl",
				".nim",
				".zig",
				".d",
				".cr",
				".rkt",
				// Assembly
				".s",
				".asm",
				// Markup as code
				".vue",
				".svelte",
				".astro",
			],
			not: {
				// Exclude files better handled by other categories
				tagged: ["tests", "scripts", "database", "generatedFiles"],
			},
		},

		// Default - captures everything else
		default: {},
	};

/**
 * Infer resource category from URI or type for freshness lookup.
 * Uses a two-pass approach:
 * 1. First pass: Match all categories based on URI patterns (endsWith, includes, not.endsWith, not.includes)
 * 2. Second pass: Apply not.tagged exclusions now that we have all URI-based matches
 *
 * This ensures that not.tagged exclusions work reliably regardless of category processing order.
 */
export function inferResourceCategory(uri: string): FreshnessCategory[] {
	const lowerUri = uri.toLowerCase();

	// First pass: Collect all URI-based matches (ignoring not.tagged for now)
	const uriMatches = new Set<FreshnessCategory>();

	for (const [category, clause] of Object.entries(CATEGORY_RULES)) {
		const cat = category as FreshnessCategory;

		// Skip 'default' - it's a catch-all handled at the end
		if (cat === "default") {
			continue;
		}

		if (matchClauseUri(clause, lowerUri)) {
			uriMatches.add(cat);
		}
	}

	// Second pass: Apply not.tagged exclusions
	// Now we have all URI-based matches, so we can reliably check tag-based exclusions
	const finalMatches = new Set<FreshnessCategory>();

	for (const cat of uriMatches) {
		const clause = CATEGORY_RULES[cat];
		if (!shouldExcludeByTag(clause, uriMatches)) {
			finalMatches.add(cat);
		}
	}

	return finalMatches.size > 0 ? [...finalMatches] : ["default"];
}
