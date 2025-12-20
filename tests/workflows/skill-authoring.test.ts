import { describe, it, expect, beforeEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import { factories, resetFactories } from "../factories";
import {
	createSkill,
	updateSkill,
	getSkill,
	searchSkills,
	linkSkill,
	registerSkillFromFile,
	getSkillsNeedingReview,
	markSkillReviewed,
} from "../../src/db/operations/skills";
import { submitFacts } from "../../src/db/operations/facts";
import { addResources } from "../../src/db/operations/resources";
import { setConfig } from "../../src/db/operations/config";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TEST_SKILLS_DIR = "/tmp/factsets-test-skills";

describe("skill authoring workflow", () => {
	let db: TestDB;

	beforeEach(async () => {
		resetFactories();
		db = await createTestDb();
		await setConfig(db, "skills_dir", TEST_SKILLS_DIR);
		await rm(TEST_SKILLS_DIR, { recursive: true, force: true });
		await mkdir(TEST_SKILLS_DIR, { recursive: true });
	});

	describe("creating a skill from learned knowledge", () => {
		it("creates skill with markdown content", async () => {
			const result = await createSkill(db, {
				name: "git-workflow",
				title: "Git Workflow Guide",
				content: "# Git Workflow\n\n## Branching\n\nUse feature branches.",
				tags: ["git", "workflow"],
			});

			expect(result.name).toBe("git-workflow");
			expect(result.filePath).toContain("git-workflow.md");

			const file = Bun.file(result.filePath);
			expect(await file.exists()).toBe(true);
			expect(await file.text()).toContain("# Git Workflow");
		});

		it("links skill to referenced facts", async () => {
			const facts = await submitFacts(db, {
				facts: [
					{ content: "Always rebase before merge", tags: ["git"] },
					{ content: "Use conventional commits", tags: ["git"] },
				],
			});

			const factIds = facts.facts.map((f) => f.id);

			const skill = await createSkill(db, {
				name: "git-practices",
				title: "Git Best Practices",
				content: "# Git Practices",
				tags: ["git"],
				references: { facts: factIds },
			});

			const retrieved = await getSkill(db, { name: skill.name });
			expect(retrieved?.references.facts).toHaveLength(2);
		});

		it("links skill to referenced resources", async () => {
			const resources = await addResources(db, {
				resources: [
					{
						uri: "file:///.gitconfig",
						type: "file",
						tags: ["git"],
						snapshot: "[user]\nname=Test",
					},
				],
			});

			const resourceIds = resources.resources.map((r) => r.id);

			const skill = await createSkill(db, {
				name: "git-config",
				title: "Git Configuration",
				content: "# Git Config",
				tags: ["git"],
				references: { resources: resourceIds },
			});

			const retrieved = await getSkill(db, { name: skill.name });
			expect(retrieved?.references.resources).toHaveLength(1);
		});
	});

	describe("skill composition", () => {
		it("creates skill that references other skills", async () => {
			const baseSkill = await createSkill(db, {
				name: "base-skill",
				title: "Base Skill",
				content: "# Base",
				tags: ["base"],
			});

			const compositeSkill = await createSkill(db, {
				name: "composite-skill",
				title: "Composite Skill",
				content: "# Composite\n\nBuilds on base skill.",
				tags: ["composite"],
				references: { skills: [baseSkill.name] },
			});

			const retrieved = await getSkill(db, { name: compositeSkill.name });
			expect(retrieved?.references.skills).toHaveLength(1);
			expect(retrieved?.references.skills[0]!.name).toBe("base-skill");
		});

		it("retrieves skill with hydrated references", async () => {
			const prereq = await createSkill(db, {
				name: "prereq-skill",
				title: "Prerequisite",
				content: "# Prerequisites\n\nYou need to know X first.",
				tags: ["prereq"],
			});

			const main = await createSkill(db, {
				name: "main-skill",
				title: "Main Skill",
				content: "# Main\n\nThe main content.",
				tags: ["main"],
				references: { skills: [prereq.name] },
			});

			const withoutHydration = await getSkill(db, {
				name: main.name,
				hydrateRefs: false,
			});
			expect(withoutHydration?.hydratedSkills).toBeUndefined();

			const withHydration = await getSkill(db, {
				name: main.name,
				hydrateRefs: true,
			});
			expect(withHydration?.hydratedSkills).toHaveLength(1);
			expect(withHydration?.hydratedSkills![0]!.content).toContain(
				"Prerequisites",
			);
		});
	});

	describe("skill updates", () => {
		it("syncs skill content hash after file edit", async () => {
			const skill = await createSkill(db, {
				name: "updatable-skill",
				title: "Updatable",
				content: "# Original",
				tags: ["test"],
			});

			// Edit the file directly (simulating external edit)
			const newContent = "# Updated Content\n\nNew version of the skill.";
			await Bun.write(skill.filePath, newContent);

			// Sync the skill to update the hash
			const { syncSkill } = await import("../../src/db/operations/skills");
			const syncResult = await syncSkill(db, { name: skill.name });
			expect(syncResult.updated).toBe(true);

			const retrieved = await getSkill(db, { name: skill.name });
			expect(retrieved?.content).toContain("Updated Content");

			const file = Bun.file(skill.filePath);
			expect(await file.text()).toContain("Updated Content");
		});

		it("adds and removes skill references", async () => {
			const refA = await createSkill(db, {
				...factories.skill(),
				name: "ref-a",
			});
			const refB = await createSkill(db, {
				...factories.skill(),
				name: "ref-b",
			});

			const main = await createSkill(db, {
				name: "main-refs",
				title: "Main",
				content: "# Main",
				tags: ["test"],
				references: { skills: [refA.name] },
			});

			let retrieved = await getSkill(db, { name: main.name });
			expect(retrieved?.references.skills).toHaveLength(1);

			await updateSkill(db, {
				name: main.name,
				references: {
					skills: { add: [refB.name], remove: [refA.name] },
				},
			});

			retrieved = await getSkill(db, { name: main.name });
			expect(retrieved?.references.skills).toHaveLength(1);
			expect(retrieved?.references.skills[0]!.name).toBe("ref-b");
		});

		it("appends tags without replacing existing", async () => {
			const skill = await createSkill(db, {
				name: "tagged-skill",
				title: "Tagged",
				content: "# Tagged",
				tags: ["original"],
			});

			await updateSkill(db, {
				name: skill.name,
				appendTags: ["appended"],
			});

			const retrieved = await getSkill(db, { name: skill.name });
			expect(retrieved?.tags).toContain("original");
			expect(retrieved?.tags).toContain("appended");
		});
	});

	describe("skill search", () => {
		it("finds skills by tag", async () => {
			await createSkill(db, { ...factories.skill(), tags: ["searchable"] });
			await createSkill(db, { ...factories.skill(), tags: ["searchable"] });
			await createSkill(db, { ...factories.skill(), tags: ["other"] });

			const results = await searchSkills(db, { tags: ["searchable"] });
			expect(results.skills).toHaveLength(2);
		});

		it("finds skills by title query", async () => {
			await createSkill(db, {
				...factories.skill(),
				title: "Database Setup Guide",
			});
			await createSkill(db, { ...factories.skill(), title: "API Integration" });

			const results = await searchSkills(db, { query: "Database" });
			expect(results.skills).toHaveLength(1);
			expect(results.skills[0]!.title).toContain("Database");
		});
	});

	describe("skill linking", () => {
		it("links skill to resources and facts after creation", async () => {
			const skill = await createSkill(db, factories.skill());

			const facts = await submitFacts(db, {
				facts: [{ content: "Linked fact", tags: ["link-test"] }],
			});

			const resources = await addResources(db, {
				resources: [
					{ uri: "file:///linked.ts", type: "file", tags: ["link-test"] },
				],
			});

			await linkSkill(db, {
				skillName: skill.name,
				linkFacts: facts.facts.map((f) => f.id),
				linkResources: resources.resources.map((r) => r.id),
			});

			const retrieved = await getSkill(db, { name: skill.name });
			expect(retrieved?.references.facts).toHaveLength(1);
			expect(retrieved?.references.resources).toHaveLength(1);
		});
	});

	describe("auto-registration from files", () => {
		it("registers skill from existing file with needsReview flag", async () => {
			const filePath = join(TEST_SKILLS_DIR, "external-skill.md");
			await writeFile(
				filePath,
				"# External Skill\n\nThis was created outside the tool.",
			);

			const result = await registerSkillFromFile(db, filePath);

			expect(result).not.toBeNull();
			expect(result?.name).toBe("external-skill");
			expect(result?.isNew).toBe(true);

			// Check it's flagged for review
			const needsReview = await getSkillsNeedingReview(db);
			expect(needsReview.length).toBe(1);
			expect(needsReview[0]?.name).toBe("external-skill");
		});

		it("extracts title from first markdown heading", async () => {
			const filePath = join(TEST_SKILLS_DIR, "titled-skill.md");
			await writeFile(filePath, "# My Custom Title\n\nContent here.");

			await registerSkillFromFile(db, filePath);

			const skill = await getSkill(db, { name: "titled-skill" });
			expect(skill?.title).toBe("My Custom Title");
		});

		it("uses filename as title when no heading", async () => {
			const filePath = join(TEST_SKILLS_DIR, "no-heading.md");
			await writeFile(filePath, "Just some content without a heading.");

			await registerSkillFromFile(db, filePath);

			const skill = await getSkill(db, { name: "no-heading" });
			expect(skill?.title).toBe("no-heading");
		});

		it("returns existing skill without re-registering", async () => {
			const skill = await createSkill(db, {
				name: "existing-skill",
				title: "Existing",
				content: "# Existing",
				tags: ["test"],
			});

			const result = await registerSkillFromFile(db, skill.filePath);

			expect(result?.isNew).toBe(false);
			expect(result?.id).toBe(skill.id);
		});

		it("ignores non-markdown files", async () => {
			const filePath = join(TEST_SKILLS_DIR, "not-markdown.txt");
			await writeFile(filePath, "Not a markdown file");

			const result = await registerSkillFromFile(db, filePath);
			expect(result).toBeNull();
		});
	});

	describe("skill review workflow", () => {
		it("clears needsReview when skill is updated via tool", async () => {
			const filePath = join(TEST_SKILLS_DIR, "review-me.md");
			await writeFile(filePath, "# Review Me\n\nNeeds tags and description.");

			await registerSkillFromFile(db, filePath);

			// Verify it needs review
			let needsReview = await getSkillsNeedingReview(db);
			expect(needsReview.length).toBe(1);

			// Update via tool
			await updateSkill(db, {
				name: "review-me",
				description: "Now has a description",
				appendTags: ["reviewed"],
			});

			// Should no longer need review
			needsReview = await getSkillsNeedingReview(db);
			expect(needsReview.length).toBe(0);
		});

		it("marks skill as reviewed explicitly", async () => {
			const filePath = join(TEST_SKILLS_DIR, "explicit-review.md");
			await writeFile(filePath, "# Explicit Review");

			await registerSkillFromFile(db, filePath);

			// Mark as reviewed
			const result = await markSkillReviewed(db, "explicit-review");
			expect(result.success).toBe(true);

			// Should no longer need review
			const needsReview = await getSkillsNeedingReview(db);
			expect(needsReview.length).toBe(0);
		});
	});
});
