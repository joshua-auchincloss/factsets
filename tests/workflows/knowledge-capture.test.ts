import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import { factories, resetFactories } from "../factories";
import {
	submitFacts,
	searchFacts,
	verifyFacts,
} from "../../src/db/operations/facts";
import {
	addResources,
	searchResources,
} from "../../src/db/operations/resources";
import { createTags, listTags } from "../../src/db/operations/tags";
import { setConfig } from "../../src/db/operations/config";

describe("knowledge capture workflow", () => {
	let db: TestDB;

	beforeEach(async () => {
		resetFactories();
		db = await createTestDb();
		await setConfig(db, "skills_dir", "/tmp/factsets-test");
	});

	describe("learning about a new codebase", () => {
		it("creates tags for project concepts", async () => {
			const result = await createTags(db, {
				tags: [
					{ name: "react", description: "React framework concepts" },
					{ name: "hooks", description: "React hooks patterns" },
					{
						name: "state-management",
						description: "State management patterns and approaches",
					},
				],
			});

			expect(result.created).toBe(3);
			expect(result.tags).toHaveLength(3);

			const listed = await listTags(db, {});
			expect(listed.tags).toHaveLength(3);
		});

		it("submits facts discovered from code analysis", async () => {
			const result = await submitFacts(db, {
				facts: [
					{
						content: "useEffect runs after render",
						tags: ["react", "hooks"],
						sourceType: "code",
					},
					{
						content: "useState returns tuple of value and setter",
						tags: ["react", "hooks"],
						sourceType: "code",
					},
					{
						content: "Components must return JSX or null",
						tags: ["react"],
						sourceType: "documentation",
					},
				],
			});

			expect(result.created).toBe(3);
			expect(result.updated).toBe(0);
			expect(result.facts).toHaveLength(3);
		});

		it("registers resources with retrieval methods", async () => {
			const result = await addResources(db, {
				resources: [
					{
						uri: "file:///src/App.tsx",
						type: "file",
						tags: ["react", "component"],
						snapshot: "export function App() { return <div>Hello</div> }",
						retrievalMethod: { type: "file" },
					},
					{
						uri: "https://react.dev/reference/react/useState",
						type: "url",
						tags: ["react", "hooks", "docs"],
						retrievalMethod: {
							type: "url",
							url: "https://react.dev/reference/react/useState",
						},
					},
				],
			});

			expect(result.created).toBe(2);
			expect(result.resources[0]!.hasSnapshot).toBe(true);
			expect(result.resources[1]!.hasSnapshot).toBe(false);
		});

		it("associates facts and resources with tags", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "React uses virtual DOM", tags: ["react", "performance"] },
				],
			});

			await addResources(db, {
				resources: [
					{
						uri: "file:///perf.md",
						type: "file",
						tags: ["react", "performance"],
					},
				],
			});

			const facts = await searchFacts(db, { tags: ["performance"] });
			const resources = await searchResources(db, { tags: ["performance"] });

			expect(facts.facts).toHaveLength(1);
			expect(resources.resources).toHaveLength(1);
		});

		it("retrieves related knowledge by tag", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Fact about hooks", tags: ["hooks"] },
					{ content: "Fact about state", tags: ["state"] },
					{ content: "Fact about both", tags: ["hooks", "state"] },
				],
			});

			const hooksOnly = await searchFacts(db, { tags: ["hooks"] });
			expect(hooksOnly.facts.length).toBeGreaterThanOrEqual(2);

			const stateOnly = await searchFacts(db, { tags: ["state"] });
			expect(stateOnly.facts.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("updating existing knowledge", () => {
		it("updates facts when content matches existing", async () => {
			const first = await submitFacts(db, {
				facts: [{ content: "Initial fact", tags: ["test"], verified: false }],
			});

			const second = await submitFacts(db, {
				facts: [
					{
						content: "Initial fact",
						tags: ["test"],
						verified: true,
						sourceType: "user",
					},
				],
			});

			expect(first.created).toBe(1);
			expect(second.created).toBe(0);
			expect(second.updated).toBe(1);
		});

		it("skips duplicate resource registration", async () => {
			const first = await addResources(db, {
				resources: [{ uri: "file:///unique.ts", type: "file", tags: ["test"] }],
			});

			const second = await addResources(db, {
				resources: [{ uri: "file:///unique.ts", type: "file", tags: ["test"] }],
			});

			expect(first.created).toBe(1);
			expect(second.created).toBe(0);
			expect(second.resources[0]!.id).toBe(first.resources[0]!.id);
		});

		it("reports correct hasSnapshot status for existing resources", async () => {
			// Add resource with snapshot
			const first = await addResources(db, {
				resources: [
					{
						uri: "file:///with-snapshot.ts",
						type: "file",
						tags: ["test"],
						snapshot: "const x = 1;",
					},
				],
			});
			expect(first.resources[0]!.hasSnapshot).toBe(true);

			// Adding same resource again should report hasSnapshot: true
			const second = await addResources(db, {
				resources: [
					{ uri: "file:///with-snapshot.ts", type: "file", tags: ["test"] },
				],
			});
			expect(second.created).toBe(0);
			expect(second.resources[0]!.hasSnapshot).toBe(true);

			// Add resource without snapshot
			const third = await addResources(db, {
				resources: [
					{ uri: "file:///no-snapshot.ts", type: "file", tags: ["test"] },
				],
			});
			expect(third.resources[0]!.hasSnapshot).toBe(false);

			// Adding same resource again should report hasSnapshot: false
			const fourth = await addResources(db, {
				resources: [
					{ uri: "file:///no-snapshot.ts", type: "file", tags: ["test"] },
				],
			});
			expect(fourth.created).toBe(0);
			expect(fourth.resources[0]!.hasSnapshot).toBe(false);
		});

		it("verifies facts after confirmation", async () => {
			const submitted = await submitFacts(db, {
				facts: [
					{ content: "Unverified fact 1", tags: ["test"], verified: false },
					{ content: "Unverified fact 2", tags: ["test"], verified: false },
				],
			});

			const ids = submitted.facts.map((f) => f.id);
			await verifyFacts(db, { ids });

			const search = await searchFacts(db, {
				tags: ["test"],
				verifiedOnly: true,
			});
			expect(search.facts).toHaveLength(2);
		});
	});

	describe("bulk operations", () => {
		it("handles batch fact submission efficiently", async () => {
			const facts = factories.facts(50, { tags: ["bulk-test"] });
			const result = await submitFacts(db, { facts });

			expect(result.created).toBe(50);
			expect(result.facts).toHaveLength(50);
		});

		it("handles batch resource registration efficiently", async () => {
			const resources = factories.resources(30, { tags: ["bulk-test"] });
			const result = await addResources(db, { resources });

			expect(result.created).toBe(30);
			expect(result.resources).toHaveLength(30);
		});

		it("creates tags on-demand during fact creation", async () => {
			await submitFacts(db, {
				facts: [
					{ content: "Fact with new tags", tags: ["auto-tag-1", "auto-tag-2"] },
				],
			});

			const tags = await listTags(db, {});
			const tagNames = tags.tags.map((t) => t.name);

			expect(tagNames).toContain("auto-tag-1");
			expect(tagNames).toContain("auto-tag-2");
		});

		it("handles empty arrays gracefully", async () => {
			const factResult = await submitFacts(db, { facts: [] });
			const resourceResult = await addResources(db, { resources: [] });

			expect(factResult.created).toBe(0);
			expect(resourceResult.created).toBe(0);
		});
	});
});
