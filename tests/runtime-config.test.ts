import { describe, expect, it, beforeEach } from "bun:test";
import {
	setRuntimeConfig,
	getRuntimeConfig,
	getEffectiveClient,
	getEffectiveSkillsDir,
	inferResourceCategory,
	getFreshnessForCategory,
	getFreshnessForCategories,
	DEFAULT_FRESHNESS_CONFIG,
} from "../src/runtime-config";

describe("runtime-config", () => {
	beforeEach(() => {
		// Reset runtime config before each test
		setRuntimeConfig({});
	});

	describe("setRuntimeConfig / getRuntimeConfig", () => {
		it("sets and gets runtime config", () => {
			setRuntimeConfig({ client: "cursor" });
			expect(getRuntimeConfig()).toEqual({ client: "cursor" });
		});

		it("overwrites previous config", () => {
			setRuntimeConfig({ client: "cursor" });
			setRuntimeConfig({ skillsDir: "./custom" });
			expect(getRuntimeConfig()).toEqual({ skillsDir: "./custom" });
		});

		it("can set both client and skillsDir", () => {
			setRuntimeConfig({ client: "claude", skillsDir: "./skills" });
			expect(getRuntimeConfig()).toEqual({
				client: "claude",
				skillsDir: "./skills",
			});
		});
	});

	describe("getEffectiveClient", () => {
		it("returns runtime config client when set", () => {
			setRuntimeConfig({ client: "cursor" });
			expect(getEffectiveClient("github-copilot")).toBe("cursor");
		});

		it("returns db client when runtime not set", () => {
			expect(getEffectiveClient("claude")).toBe("claude");
		});

		it("returns default when no config", () => {
			expect(getEffectiveClient()).toBe("github-copilot");
		});

		it("returns default for invalid db client", () => {
			expect(getEffectiveClient("invalid-client")).toBe("github-copilot");
		});

		it("returns default for null db client", () => {
			expect(getEffectiveClient(null)).toBe("github-copilot");
		});

		it("runtime config takes precedence over valid db client", () => {
			setRuntimeConfig({ client: "generic" });
			expect(getEffectiveClient("cursor")).toBe("generic");
		});
	});

	describe("getEffectiveSkillsDir", () => {
		it("returns runtime skillsDir when set", () => {
			setRuntimeConfig({ skillsDir: "./my-skills" });
			expect(getEffectiveSkillsDir(".github/prompts/skills", "cursor")).toBe(
				"./my-skills",
			);
		});

		it("returns db skillsDir when runtime not set", () => {
			expect(getEffectiveSkillsDir("./db-skills")).toBe("./db-skills");
		});

		it("derives from effective client when no dir set", () => {
			expect(getEffectiveSkillsDir(null, "cursor")).toBe(
				".cursor/prompts/skills",
			);
		});

		it("uses default client path when nothing set", () => {
			expect(getEffectiveSkillsDir()).toBe(".github/prompts/skills");
		});

		it("runtime skillsDir takes precedence over db skillsDir", () => {
			setRuntimeConfig({ skillsDir: "./runtime-skills" });
			expect(getEffectiveSkillsDir("./db-skills", "cursor")).toBe(
				"./runtime-skills",
			);
		});

		it("db skillsDir takes precedence over client-derived path", () => {
			expect(getEffectiveSkillsDir("./custom-path", "cursor")).toBe(
				"./custom-path",
			);
		});
	});

	describe("inferResourceCategory", () => {
		describe("lock files", () => {
			it("identifies package-lock.json", () => {
				expect(inferResourceCategory("package-lock.json")).toContain(
					"lockFiles",
				);
			});

			it("identifies yarn.lock", () => {
				expect(inferResourceCategory("yarn.lock")).toContain("lockFiles");
			});

			it("identifies bun.lockb", () => {
				expect(inferResourceCategory("bun.lockb")).toContain("lockFiles");
			});

			it("identifies Cargo.lock", () => {
				expect(inferResourceCategory("Cargo.lock")).toContain("lockFiles");
			});

			it("identifies go.sum", () => {
				expect(inferResourceCategory("go.sum")).toContain("lockFiles");
			});

			it("identifies poetry.lock", () => {
				expect(inferResourceCategory("poetry.lock")).toContain("lockFiles");
			});
		});

		describe("database files", () => {
			it("identifies .sql files", () => {
				expect(inferResourceCategory("schema.sql")).toContain("database");
			});

			it("identifies migration files", () => {
				expect(
					inferResourceCategory("/db/migrations/001_initial.sql"),
				).toContain("database");
			});

			it("identifies prisma schema", () => {
				expect(inferResourceCategory("schema.prisma")).toContain("database");
			});

			it("identifies seed files", () => {
				expect(inferResourceCategory("/seeds/users.sql")).toContain("database");
			});

			it("identifies drizzle files", () => {
				expect(inferResourceCategory("/drizzle/schema.ts")).toContain(
					"database",
				);
			});
		});

		describe("test files", () => {
			it("identifies .test.ts files", () => {
				expect(inferResourceCategory("utils.test.ts")).toContain("tests");
			});

			it("identifies .spec.js files", () => {
				expect(inferResourceCategory("component.spec.js")).toContain("tests");
			});

			it("identifies Python test files", () => {
				expect(inferResourceCategory("test_utils.py")).toContain("tests");
			});

			it("identifies Go test files", () => {
				expect(inferResourceCategory("handler_test.go")).toContain("tests");
			});

			it("identifies __tests__ directory", () => {
				expect(inferResourceCategory("/__tests__/App.test.tsx")).toContain(
					"tests",
				);
			});

			it("identifies fixture files", () => {
				expect(inferResourceCategory("/fixtures/users.json")).toContain(
					"tests",
				);
			});
		});

		describe("infrastructure files", () => {
			it("identifies Terraform files", () => {
				expect(inferResourceCategory("main.tf")).toContain("infrastructure");
			});

			it("identifies Dockerfile", () => {
				expect(inferResourceCategory("Dockerfile")).toContain("infrastructure");
			});

			it("identifies docker-compose.yaml", () => {
				expect(inferResourceCategory("docker-compose.yaml")).toContain(
					"infrastructure",
				);
			});

			it("identifies GitHub Actions workflows", () => {
				expect(inferResourceCategory(".github/workflows/ci.yaml")).toContain(
					"infrastructure",
				);
			});

			it("identifies Kubernetes manifests", () => {
				expect(inferResourceCategory("/k8s/deployment.yaml")).toContain(
					"infrastructure",
				);
			});

			it("identifies Helm charts", () => {
				expect(inferResourceCategory("Chart.yaml")).toContain("infrastructure");
			});
		});

		describe("API schemas", () => {
			it("identifies GraphQL files", () => {
				expect(inferResourceCategory("schema.graphql")).toContain("apiSchemas");
			});

			it("identifies Proto files", () => {
				expect(inferResourceCategory("service.proto")).toContain("apiSchemas");
			});

			it("identifies OpenAPI specs by extension", () => {
				expect(inferResourceCategory("api.openapi.yaml")).toContain(
					"apiSchemas",
				);
			});

			it("identifies swagger.yaml", () => {
				expect(inferResourceCategory("swagger.yaml")).toContain("apiSchemas");
			});

			it("does NOT categorize generic schema.json as apiSchemas", () => {
				// Generic "schema" is ambiguous - could be DB, validation, or API
				expect(inferResourceCategory("schema.json")).not.toContain(
					"apiSchemas",
				);
			});
		});

		describe("scripts", () => {
			it("identifies shell scripts", () => {
				expect(inferResourceCategory("build.sh")).toContain("scripts");
			});

			it("identifies PowerShell scripts", () => {
				expect(inferResourceCategory("deploy.ps1")).toContain("scripts");
			});

			it("identifies Makefile", () => {
				expect(inferResourceCategory("Makefile")).toContain("scripts");
			});

			it("identifies files in /scripts/ directory", () => {
				expect(inferResourceCategory("/scripts/setup.js")).toContain("scripts");
			});

			it("identifies husky hooks", () => {
				expect(inferResourceCategory(".husky/pre-commit")).toContain("scripts");
			});
		});

		describe("generated files", () => {
			it("identifies minified JS", () => {
				expect(inferResourceCategory("app.min.js")).toContain("generatedFiles");
			});

			it("identifies source maps", () => {
				expect(inferResourceCategory("app.js.map")).toContain("generatedFiles");
			});

			it("identifies dist directory files", () => {
				expect(inferResourceCategory("/dist/bundle.js")).toContain(
					"generatedFiles",
				);
			});

			it("identifies build outputs", () => {
				expect(inferResourceCategory("/build/index.js")).toContain(
					"generatedFiles",
				);
			});

			it("identifies Python bytecode", () => {
				expect(inferResourceCategory("module.pyc")).toContain("generatedFiles");
			});
		});

		describe("assets", () => {
			it("identifies images", () => {
				expect(inferResourceCategory("logo.png")).toContain("assets");
			});

			it("identifies fonts", () => {
				expect(inferResourceCategory("font.woff2")).toContain("assets");
			});

			it("identifies video files", () => {
				expect(inferResourceCategory("intro.mp4")).toContain("assets");
			});

			it("identifies files in /assets/ directory", () => {
				expect(inferResourceCategory("/assets/icon.svg")).toContain("assets");
			});
		});

		describe("documentation", () => {
			it("identifies markdown files", () => {
				expect(inferResourceCategory("README.md")).toContain("documentation");
			});

			it("identifies files in /docs/ directory", () => {
				expect(inferResourceCategory("/docs/api.md")).toContain(
					"documentation",
				);
			});

			it("identifies CHANGELOG", () => {
				expect(inferResourceCategory("CHANGELOG.md")).toContain(
					"documentation",
				);
			});
		});

		describe("config files", () => {
			it("identifies tsconfig.json", () => {
				expect(inferResourceCategory("tsconfig.json")).toContain("configFiles");
			});

			it("identifies .env files", () => {
				expect(inferResourceCategory(".env.local")).toContain("configFiles");
			});

			it("identifies pyproject.toml", () => {
				expect(inferResourceCategory("pyproject.toml")).toContain(
					"configFiles",
				);
			});

			it("identifies vite.config.ts", () => {
				expect(inferResourceCategory("vite.config.ts")).toContain(
					"configFiles",
				);
			});
		});

		describe("source code", () => {
			it("identifies TypeScript files", () => {
				expect(inferResourceCategory("utils.ts")).toContain("sourceCode");
			});

			it("identifies Python files", () => {
				expect(inferResourceCategory("main.py")).toContain("sourceCode");
			});

			it("identifies Rust files", () => {
				expect(inferResourceCategory("lib.rs")).toContain("sourceCode");
			});

			it("identifies Go files (non-test)", () => {
				expect(inferResourceCategory("main.go")).toContain("sourceCode");
			});

			it("identifies Vue components", () => {
				expect(inferResourceCategory("App.vue")).toContain("sourceCode");
			});
		});

		describe("default category", () => {
			it("returns default for unknown extensions", () => {
				expect(inferResourceCategory("file.xyz")).toEqual(["default"]);
			});

			it("identifies LICENSE as documentation", () => {
				// LICENSE matches documentation includes pattern
				expect(inferResourceCategory("LICENSE")).toContain("documentation");
			});

			it("returns default for truly unknown files", () => {
				expect(inferResourceCategory("random-file.unknown")).toEqual([
					"default",
				]);
			});
		});

		describe("disambiguation", () => {
			it("prioritizes lockFiles over configFiles for package-lock.json", () => {
				const categories = inferResourceCategory("package-lock.json");
				expect(categories).toContain("lockFiles");
			});

			it("identifies test fixtures in /fixtures/ as tests", () => {
				const categories = inferResourceCategory("/fixtures/data.json");
				expect(categories).toContain("tests");
			});

			it("does not categorize generic /api/ paths as apiSchemas", () => {
				// /api/ alone is too generic - could be API routes, not schemas
				const categories = inferResourceCategory("/api/users.ts");
				expect(categories).not.toContain("apiSchemas");
			});
		});
	});

	describe("getFreshnessForCategory", () => {
		it("returns configured threshold for known category", () => {
			expect(getFreshnessForCategory("lockFiles")).toBe(
				DEFAULT_FRESHNESS_CONFIG.lockFiles,
			);
			expect(getFreshnessForCategory("tests")).toBe(
				DEFAULT_FRESHNESS_CONFIG.tests,
			);
			expect(getFreshnessForCategory("generatedFiles")).toBe(
				DEFAULT_FRESHNESS_CONFIG.generatedFiles,
			);
		});

		it("returns default threshold for default category", () => {
			expect(getFreshnessForCategory("default")).toBe(
				DEFAULT_FRESHNESS_CONFIG.default,
			);
		});
	});

	describe("getFreshnessForCategories", () => {
		it("returns minimum threshold across multiple categories", () => {
			// generatedFiles=1h, tests=24h - should return 1h
			const threshold = getFreshnessForCategories(["generatedFiles", "tests"]);
			expect(threshold).toBe(1); // generatedFiles is 1 hour
		});

		it("returns single category threshold for single-element array", () => {
			const threshold = getFreshnessForCategories(["lockFiles"]);
			expect(threshold).toBe(DEFAULT_FRESHNESS_CONFIG.lockFiles);
		});

		it("returns default threshold for empty array", () => {
			const threshold = getFreshnessForCategories([]);
			expect(threshold).toBe(DEFAULT_FRESHNESS_CONFIG.default);
		});

		it("handles categories with same threshold", () => {
			// Both tests and sourceCode have 24h threshold (but sourceCode is 12h)
			const threshold = getFreshnessForCategories([
				"sourceCode",
				"configFiles",
			]);
			expect(threshold).toBe(
				Math.min(
					DEFAULT_FRESHNESS_CONFIG.sourceCode,
					DEFAULT_FRESHNESS_CONFIG.configFiles,
				),
			);
		});

		it("uses strictest threshold for test file that is also source code", () => {
			// A .test.ts file could match both tests (24h) and sourceCode (12h)
			// Should use minimum: 12h
			const categories = inferResourceCategory("example.test.ts");
			expect(categories).toContain("tests");

			const threshold = getFreshnessForCategories(categories as any);
			expect(threshold).toBeLessThanOrEqual(DEFAULT_FRESHNESS_CONFIG.tests);
		});

		it("uses strictest threshold for generated file in dist", () => {
			// dist/app.min.js matches generatedFiles (1h)
			const categories = inferResourceCategory("/dist/app.min.js");
			expect(categories).toContain("generatedFiles");

			const threshold = getFreshnessForCategories(categories as any);
			expect(threshold).toBe(DEFAULT_FRESHNESS_CONFIG.generatedFiles);
		});
	});
});
