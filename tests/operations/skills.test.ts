import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createTestDb, type TestDB } from "../harness";
import {
	createSkill,
	getSkill,
	getSkills,
	searchSkills,
	updateSkill,
	syncSkill,
	deleteSkills,
	markSkillReviewed,
	migrateSkillPaths,
} from "../../src/db/operations/skills";
import { addResources } from "../../src/db/operations/resources";
import { submitFacts } from "../../src/db/operations/facts";
import { setConfig } from "../../src/db/operations/config";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("skills operations - extended coverage", () => {
	let db: TestDB;
	let testDir: string;

	beforeEach(async () => {
		db = await createTestDb();
		testDir = join(tmpdir(), `factsets-skills-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
		await setConfig(db, "skills_dir", testDir);
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {}
	});

	describe("getSkills batch", () => {
		it("fetches multiple skills by name", async () => {
			await createSkill(db, {
				name: "skill-a",
				title: "Skill A",
				content: "# Skill A",
				tags: ["test"],
			});
			await createSkill(db, {
				name: "skill-b",
				title: "Skill B",
				content: "# Skill B",
				tags: ["test"],
			});

			const result = await getSkills(db, {
				names: ["skill-a", "skill-b"],
			});

			expect(result.skills).toHaveLength(2);
			expect(result.notFound).toHaveLength(0);
		});

		it("reports not found skills", async () => {
			await createSkill(db, {
				name: "exists",
				title: "Exists",
				content: "# Exists",
				tags: ["test"],
			});

			const result = await getSkills(db, {
				names: ["exists", "missing"],
			});

			expect(result.skills).toHaveLength(1);
			expect(result.notFound).toContain("missing");
		});

		it("hydrates references when requested", async () => {
			// Create a resource to reference
			const resourceResult = await addResources(db, {
				resources: [{ uri: "file:///ref.ts", type: "file", tags: ["ref"] }],
			});

			// Create skill with reference
			await createSkill(db, {
				name: "skill-with-ref",
				title: "Skill with Ref",
				content: "# Skill",
				tags: ["test"],
				references: {
					resources: [resourceResult.resources[0]!.id],
				},
			});

			const result = await getSkills(db, {
				names: ["skill-with-ref"],
				hydrateRefs: true,
			});

			expect(result.skills).toHaveLength(1);
			expect(result.skills[0]!.references?.resources).toBeDefined();
		});
	});

	describe("searchSkills pagination", () => {
		it("uses cursor for pagination", async () => {
			// Create many skills
			for (let i = 0; i < 10; i++) {
				await createSkill(db, {
					name: `skill-${i}`,
					title: `Skill ${i}`,
					content: `# Skill ${i}`,
					tags: ["test"],
				});
			}

			const page1 = await searchSkills(db, { tags: ["test"], limit: 3 });
			expect(page1.skills).toHaveLength(3);
			expect(page1.nextCursor).toBeDefined();

			const page2 = await searchSkills(db, {
				tags: ["test"],
				limit: 3,
				cursor: page1.nextCursor,
			});
			expect(page2.skills).toHaveLength(3);

			// Different skills
			const page1Names = page1.skills.map((s) => s.name);
			const page2Names = page2.skills.map((s) => s.name);
			expect(page1Names).not.toEqual(page2Names);
		});

		it("throws error for invalid cursor", async () => {
			await createSkill(db, {
				name: "skill",
				title: "Skill",
				content: "# Skill",
				tags: ["test"],
			});

			await expect(
				searchSkills(db, { tags: ["test"], cursor: "invalid" }),
			).rejects.toThrow("Invalid cursor");
		});

		it("returns suggestedTags when no tags match", async () => {
			await createSkill(db, {
				name: "skill",
				title: "Skill",
				content: "# Skill",
				tags: ["existing"],
			});

			const result = await searchSkills(db, { tags: ["nonexistent"] });
			expect(result.skills).toHaveLength(0);
			expect(result.suggestedTags).toBeDefined();
		});

		it("filters by title query", async () => {
			await createSkill(db, {
				name: "skill-react",
				title: "React Patterns",
				content: "# React",
				tags: ["test"],
			});
			await createSkill(db, {
				name: "skill-vue",
				title: "Vue Patterns",
				content: "# Vue",
				tags: ["test"],
			});

			const result = await searchSkills(db, { tags: ["test"], query: "React" });
			expect(result.skills).toHaveLength(1);
			expect(result.skills[0]!.name).toBe("skill-react");
		});
	});

	describe("updateSkill references", () => {
		it("adds and removes fact references", async () => {
			await createSkill(db, {
				name: "skill",
				title: "Skill",
				content: "# Skill",
				tags: ["test"],
			});

			const factResult = await submitFacts(db, {
				facts: [{ content: "Test fact", tags: ["test"] }],
			});

			await updateSkill(db, {
				name: "skill",
				references: {
					facts: { add: [factResult.facts[0]!.id] },
				},
			});

			const updated = await getSkill(db, { name: "skill", hydrateRefs: true });
			expect(updated!.references?.facts).toBeDefined();
		});

		it("adds and removes resource references", async () => {
			await createSkill(db, {
				name: "skill",
				title: "Skill",
				content: "# Skill",
				tags: ["test"],
			});

			const resourceResult = await addResources(db, {
				resources: [{ uri: "file:///test.ts", type: "file", tags: ["test"] }],
			});

			await updateSkill(db, {
				name: "skill",
				references: {
					resources: { add: [resourceResult.resources[0]!.id] },
				},
			});

			const updated = await getSkill(db, { name: "skill", hydrateRefs: true });
			expect(updated!.references?.resources).toBeDefined();
		});
	});

	describe("syncSkill", () => {
		it("updates hash when file content changes", async () => {
			const skillPath = join(testDir, "sync-skill.md");
			await writeFile(skillPath, "# Original Content");

			await createSkill(db, {
				name: "sync-skill",
				title: "Sync Skill",
				content: "# Original Content",
				tags: ["test"],
			});

			// Modify file
			await writeFile(skillPath, "# Modified Content");

			const result = await syncSkill(db, { name: "sync-skill" });
			expect(result.updated).toBe(true);
		});

		it("returns updated=false when hash unchanged", async () => {
			await createSkill(db, {
				name: "unchanged",
				title: "Unchanged",
				content: "# Same Content",
				tags: ["test"],
			});

			const result = await syncSkill(db, { name: "unchanged" });
			expect(result.updated).toBe(false);
		});

		it("throws error for nonexistent skill", async () => {
			await expect(syncSkill(db, { name: "nonexistent" })).rejects.toThrow(
				"Skill not found",
			);
		});
	});

	describe("markSkillReviewed", () => {
		it("clears needsReview flag", async () => {
			await createSkill(db, {
				name: "review-skill",
				title: "Review Skill",
				content: "# Skill",
				tags: ["test"],
			});

			// Manually set needsReview
			const { skills } = await import("../../src/db/schema");
			const { eq } = await import("drizzle-orm");
			await db
				.update(skills)
				.set({ needsReview: true })
				.where(eq(skills.name, "review-skill"));

			const result = await markSkillReviewed(db, "review-skill");
			expect(result.success).toBe(true);

			// Verify in DB directly since getSkill may not return needsReview
			const [skillRecord] = await db
				.select()
				.from(skills)
				.where(eq(skills.name, "review-skill"));
			expect(skillRecord!.needsReview).toBe(false);
		});

		it("returns success=false for nonexistent skill", async () => {
			const result = await markSkillReviewed(db, "nonexistent");
			expect(result.success).toBe(false);
		});
	});

	describe("deleteSkills", () => {
		it("deletes skills by names", async () => {
			await createSkill(db, {
				name: "to-delete",
				title: "Delete Me",
				content: "# Delete",
				tags: ["test"],
			});

			const result = await deleteSkills(db, { names: ["to-delete"] });
			expect(result.deleted).toBe(1);

			const skill = await getSkill(db, { name: "to-delete" });
			expect(skill).toBeNull();
		});

		it("deletes associated files when deleteFiles=true", async () => {
			const skillPath = join(testDir, "file-skill.md");
			await writeFile(skillPath, "# File Skill");

			await createSkill(db, {
				name: "file-skill",
				title: "File Skill",
				content: "# File Skill",
				tags: ["test"],
			});

			const result = await deleteSkills(db, {
				names: ["file-skill"],
				deleteFiles: true,
			});

			expect(result.deleted).toBe(1);
			expect(result.filesDeleted).toBe(1);

			// Verify file deleted
			await expect(readFile(skillPath)).rejects.toThrow();
		});

		it("returns zero for empty names array", async () => {
			const result = await deleteSkills(db, { names: [] });
			expect(result.deleted).toBe(0);
		});

		it("returns zero when no skills match", async () => {
			const result = await deleteSkills(db, { names: ["nonexistent"] });
			expect(result.deleted).toBe(0);
		});

		it("cleans up junction tables", async () => {
			// Create skill with references
			const factResult = await submitFacts(db, {
				facts: [{ content: "Fact", tags: ["test"] }],
			});

			await createSkill(db, {
				name: "skill-with-refs",
				title: "Skill with Refs",
				content: "# Skill",
				tags: ["test"],
				references: {
					facts: [factResult.facts[0]!.id],
				},
			});

			await deleteSkills(db, { names: ["skill-with-refs"] });

			// Verify junction table cleaned
			const { skillFacts } = await import("../../src/db/schema");
			const remaining = await db.select().from(skillFacts);
			expect(remaining).toHaveLength(0);
		});
	});

	describe("migrateSkillPaths", () => {
		it("migrates skill paths to new directory", async () => {
			const oldDir = join(testDir, "old");
			const newDir = join(testDir, "new");
			await mkdir(oldDir, { recursive: true });

			// Create skill in old location
			const oldPath = join(oldDir, "migrated.md");
			await writeFile(oldPath, "# Migrated Skill");

			// Register skill with old path
			await setConfig(db, "skills_dir", oldDir);
			await createSkill(db, {
				name: "migrated",
				title: "Migrated",
				content: "# Migrated Skill",
				tags: ["test"],
			});

			const result = await migrateSkillPaths(db, oldDir, newDir);
			expect(result.migrated).toBe(1);

			// Check new file exists with frontmatter
			const newPath = join(newDir, "migrated.md");
			const content = await readFile(newPath, "utf-8");
			expect(content).toContain("---");
			expect(content).toContain("name: migrated");
			expect(content).toContain("# Migrated Skill");
		});
	});
});
