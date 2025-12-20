import { eq, like, sql, inArray, and, desc, asc } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { DB } from "../index.js";
import {
	skills,
	skillTags,
	skillSkills,
	skillResources,
	skillFacts,
	tags,
	resources,
	facts,
} from "../schema.js";
import {
	getOrCreateTags,
	incrementTagUsage,
	getSuggestedTags,
} from "./tags.js";
import { getEffectiveSkillsDir } from "../../runtime-config.js";
import { getConfig } from "./config.js";
import { computeHash } from "../../utils/hash.js";
import { decodeCursor, getNextCursor } from "../../utils/cursor.js";
import type {
	SkillCreateInput,
	SkillUpdateInput,
	SkillSyncInput,
	SkillSearchInput,
	SkillGetInput,
	SkillsGetInput,
	SkillLinkInput,
	SkillCreateOutput,
	SkillSearchOutput,
	SkillGetOutput,
	SkillsGetOutput,
} from "../../schemas/skills.js";
import {
	fileExists,
	readTextFile,
	writeTextFile,
	toAbsolutePath,
	toRelativePath,
} from "../../utils/fs.js";

export async function resolveSkillsDir(db: DB): Promise<string> {
	const clientConfig = await getConfig(db, "client");
	const customDir = await getConfig(db, "skills_dir");
	return getEffectiveSkillsDir(customDir, clientConfig);
}

export async function createSkill(
	db: DB,
	input: SkillCreateInput,
): Promise<SkillCreateOutput> {
	const skillsDir = await resolveSkillsDir(db);
	// Store relative path in DB
	const relativeFilePath = join(skillsDir, `${input.name}.md`);
	// Use absolute path for file operations
	const absoluteFilePath = toAbsolutePath(relativeFilePath);
	const contentHash = computeHash(input.content);

	await mkdir(dirname(absoluteFilePath), { recursive: true });
	await writeTextFile(relativeFilePath, input.content);

	const result = await db
		.insert(skills)
		.values({
			name: input.name,
			title: input.title,
			description: input.description,
			filePath: relativeFilePath,
			contentHash,
		})
		.returning({ id: skills.id });

	if (result.length === 0) {
		throw new Error("Failed to create skill");
	}

	// biome-ignore lint/style/noNonNullAssertion: guaranteed
	const skillId = result[0]!.id;

	if (input.tags.length > 0) {
		const tagMap = await getOrCreateTags(db, input.tags);
		await db
			.insert(skillTags)
			.values(Array.from(tagMap.values()).map((tagId) => ({ skillId, tagId })))
			.onConflictDoNothing();
	}

	if (input.references?.skills?.length) {
		const refSkills = await db
			.select({ id: skills.id, name: skills.name })
			.from(skills)
			.where(inArray(skills.name, input.references.skills));

		if (refSkills.length > 0) {
			await db
				.insert(skillSkills)
				.values(
					refSkills.map((ref) => ({
						skillId,
						referencedSkillId: ref.id,
						relationType: "related",
					})),
				)
				.onConflictDoNothing();
		}
	}

	if (input.references?.resources?.length) {
		const refResources = await db
			.select({ id: resources.id, snapshotHash: resources.snapshotHash })
			.from(resources)
			.where(inArray(resources.id, input.references.resources));

		if (refResources.length > 0) {
			await db
				.insert(skillResources)
				.values(
					refResources.map((ref) => ({
						skillId,
						resourceId: ref.id,
						snapshotHashAtLink: ref.snapshotHash,
					})),
				)
				.onConflictDoNothing();
		}
	}

	if (input.references?.facts?.length) {
		await db
			.insert(skillFacts)
			.values(input.references.facts.map((factId) => ({ skillId, factId })))
			.onConflictDoNothing();
	}

	return {
		id: skillId,
		name: input.name,
		filePath: relativeFilePath,
	};
}

export async function updateSkill(
	db: DB,
	input: SkillUpdateInput,
): Promise<void> {
	const skill = await db
		.select()
		.from(skills)
		.where(eq(skills.name, input.name))
		.limit(1);

	if (skill.length === 0) {
		throw new Error(`Skill not found: ${input.name}`);
	}

	// biome-ignore lint/style/noNonNullAssertion: guaranteed
	const skillRecord = skill[0]!;
	const skillId = skillRecord.id;
	const updates: Partial<typeof skills.$inferInsert> = {
		updatedAt: sql`(CURRENT_TIMESTAMP)` as unknown as string,
		// Auto-clear needsReview when skill is updated via tool
		needsReview: false,
	};

	if (input.title) updates.title = input.title;
	if (input.description !== undefined) updates.description = input.description;

	await db.update(skills).set(updates).where(eq(skills.id, skillId));

	if (input.tags) {
		await db.delete(skillTags).where(eq(skillTags.skillId, skillId));
		const tagMap = await getOrCreateTags(db, input.tags);
		await db
			.insert(skillTags)
			.values(Array.from(tagMap.values()).map((tagId) => ({ skillId, tagId })))
			.onConflictDoNothing();
	}

	if (input.appendTags?.length) {
		const tagMap = await getOrCreateTags(db, input.appendTags);
		await db
			.insert(skillTags)
			.values(Array.from(tagMap.values()).map((tagId) => ({ skillId, tagId })))
			.onConflictDoNothing();
	}

	if (input.references?.skills) {
		if (input.references.skills.add?.length) {
			const refSkills = await db
				.select({ id: skills.id, name: skills.name })
				.from(skills)
				.where(inArray(skills.name, input.references.skills.add));

			if (refSkills.length > 0) {
				await db
					.insert(skillSkills)
					.values(
						refSkills.map((ref) => ({
							skillId,
							referencedSkillId: ref.id,
							relationType: "related",
						})),
					)
					.onConflictDoNothing();
			}
		}
		if (input.references.skills.remove?.length) {
			const refSkills = await db
				.select({ id: skills.id })
				.from(skills)
				.where(inArray(skills.name, input.references.skills.remove));

			if (refSkills.length > 0) {
				await db.delete(skillSkills).where(
					and(
						eq(skillSkills.skillId, skillId),
						inArray(
							skillSkills.referencedSkillId,
							refSkills.map((r) => r.id),
						),
					),
				);
			}
		}
	}

	if (input.references?.resources) {
		if (input.references.resources.add?.length) {
			const refResources = await db
				.select({ id: resources.id, snapshotHash: resources.snapshotHash })
				.from(resources)
				.where(inArray(resources.id, input.references.resources.add));

			if (refResources.length > 0) {
				await db
					.insert(skillResources)
					.values(
						refResources.map((ref) => ({
							skillId,
							resourceId: ref.id,
							snapshotHashAtLink: ref.snapshotHash,
						})),
					)
					.onConflictDoNothing();
			}
		}
		if (input.references.resources.remove?.length) {
			await db
				.delete(skillResources)
				.where(
					and(
						eq(skillResources.skillId, skillId),
						inArray(
							skillResources.resourceId,
							input.references.resources.remove,
						),
					),
				);
		}
	}

	if (input.references?.facts) {
		if (input.references.facts.add?.length) {
			await db
				.insert(skillFacts)
				.values(
					input.references.facts.add.map((factId) => ({ skillId, factId })),
				)
				.onConflictDoNothing();
		}
		if (input.references.facts.remove?.length) {
			await db
				.delete(skillFacts)
				.where(
					and(
						eq(skillFacts.skillId, skillId),
						inArray(skillFacts.factId, input.references.facts.remove),
					),
				);
		}
	}
}

export async function syncSkill(
	db: DB,
	input: SkillSyncInput,
): Promise<{ name: string; contentHash: string; updated: boolean }> {
	const skill = await db
		.select()
		.from(skills)
		.where(eq(skills.name, input.name))
		.limit(1);

	if (skill.length === 0) {
		throw new Error(`Skill not found: ${input.name}`);
	}

	// biome-ignore lint/style/noNonNullAssertion: guaranteed
	const skillRecord = skill[0]!;

	if (!(await fileExists(skillRecord.filePath))) {
		throw new Error(`Skill file not found: ${skillRecord.filePath}`);
	}

	const content = await readTextFile(skillRecord.filePath);
	const newHash = computeHash(content);

	if (newHash === skillRecord.contentHash) {
		return { name: input.name, contentHash: newHash, updated: false };
	}

	await db
		.update(skills)
		.set({
			contentHash: newHash,
			updatedAt: sql`(CURRENT_TIMESTAMP)` as unknown as string,
		})
		.where(eq(skills.id, skillRecord.id));

	return { name: input.name, contentHash: newHash, updated: true };
}

export async function searchSkills(
	db: DB,
	input: SkillSearchInput,
): Promise<SkillSearchOutput> {
	const limit = input.limit ?? 20;
	const tagIdsToIncrement: number[] = [];

	// Parse cursor for offset
	let offset = 0;
	if (input.cursor) {
		const cursorData = decodeCursor(input.cursor);
		if (!cursorData) {
			throw new Error("Invalid cursor");
		}
		offset = cursorData.offset;
	}

	let query = db
		.selectDistinct({
			id: skills.id,
			name: skills.name,
			title: skills.title,
			description: skills.description,
			filePath: skills.filePath,
		})
		.from(skills);

	if (input.tags && input.tags.length > 0) {
		const tagResults = await db
			.select({ id: tags.id })
			.from(tags)
			.where(inArray(tags.name, input.tags));

		if (tagResults.length === 0) {
			// No matching tags - suggest popular ones
			const suggestedTags = await getSuggestedTags(db, 5);
			return { skills: [], suggestedTags };
		}

		const tagIds = tagResults.map((t) => t.id);
		tagIdsToIncrement.push(...tagIds);

		query = query
			.innerJoin(skillTags, eq(skills.id, skillTags.skillId))
			.where(inArray(skillTags.tagId, tagIds)) as unknown as typeof query;
	}

	if (input.query) {
		const condition = like(skills.title, `%${input.query}%`);
		query = query.where(condition) as unknown as typeof query;
	}

	// Apply ordering
	const orderBy = input.orderBy ?? "recent";
	switch (orderBy) {
		case "oldest":
			query = query.orderBy(asc(skills.createdAt)) as unknown as typeof query;
			break;
		case "name":
			query = query.orderBy(asc(skills.name)) as unknown as typeof query;
			break;
		case "recent":
		default:
			query = query.orderBy(desc(skills.createdAt)) as unknown as typeof query;
			break;
	}

	// Fetch limit + 1 to determine if there are more results
	const results = await query.offset(offset).limit(limit + 1);

	// Check if there are more results
	const hasMore = results.length > limit;
	const pageResults = hasMore ? results.slice(0, limit) : results;

	if (tagIdsToIncrement.length > 0) {
		await incrementTagUsage(db, tagIdsToIncrement);
	}

	const skillsWithDetails = await Promise.all(
		pageResults.map(async (skill) => {
			const skillTagsResult = await db
				.select({ name: tags.name })
				.from(skillTags)
				.innerJoin(tags, eq(skillTags.tagId, tags.id))
				.where(eq(skillTags.skillId, skill.id));

			const hasStaleDeps = await checkSkillHasStaleDeps(db, skill.id);

			return {
				id: skill.id,
				name: skill.name,
				title: skill.title,
				description: skill.description,
				tags: skillTagsResult.map((t) => t.name),
				filePath: skill.filePath,
				hasStaleDeps,
			};
		}),
	);

	// Include suggestedTags when results are empty
	if (skillsWithDetails.length === 0) {
		const suggestedTags = await getSuggestedTags(db, 5);
		return {
			skills: [],
			suggestedTags,
		};
	}

	return {
		skills: skillsWithDetails,
		nextCursor: getNextCursor(offset, limit, results.length),
	};
}

async function checkSkillHasStaleDeps(
	db: DB,
	skillId: number,
): Promise<boolean> {
	const resourceDeps = await db
		.select({
			snapshotHashAtLink: skillResources.snapshotHashAtLink,
			currentHash: resources.snapshotHash,
		})
		.from(skillResources)
		.innerJoin(resources, eq(skillResources.resourceId, resources.id))
		.where(eq(skillResources.skillId, skillId));

	for (const dep of resourceDeps) {
		if (dep.snapshotHashAtLink !== dep.currentHash) {
			return true;
		}
	}

	return false;
}

export async function getSkill(
	db: DB,
	input: SkillGetInput,
): Promise<SkillGetOutput | null> {
	const skill = await db
		.select()
		.from(skills)
		.where(eq(skills.name, input.name))
		.limit(1);

	if (skill.length === 0) {
		return null;
	}

	// biome-ignore lint/style/noNonNullAssertion: guaranteed
	const skillRecord = skill[0]!;

	await db
		.update(skills)
		.set({
			retrievalCount: sql`${skills.retrievalCount} + 1`,
			lastRetrievedAt: sql`(CURRENT_TIMESTAMP)`,
		})
		.where(eq(skills.id, skillRecord.id));

	const content = (await fileExists(skillRecord.filePath))
		? await readTextFile(skillRecord.filePath)
		: "";

	const skillTagsResult = await db
		.select({ name: tags.name })
		.from(skillTags)
		.innerJoin(tags, eq(skillTags.tagId, tags.id))
		.where(eq(skillTags.skillId, skillRecord.id));

	const skillSkillsResult = await db
		.select({
			name: skills.name,
			title: skills.title,
			relation: skillSkills.relationType,
		})
		.from(skillSkills)
		.innerJoin(skills, eq(skillSkills.referencedSkillId, skills.id))
		.where(eq(skillSkills.skillId, skillRecord.id));

	const skillResourcesResult = await db
		.select({
			id: resources.id,
			uri: resources.uri,
			currentHash: resources.snapshotHash,
			linkHash: skillResources.snapshotHashAtLink,
		})
		.from(skillResources)
		.innerJoin(resources, eq(skillResources.resourceId, resources.id))
		.where(eq(skillResources.skillId, skillRecord.id));

	const skillFactsResult = await db
		.select({
			id: facts.id,
			content: facts.content,
		})
		.from(skillFacts)
		.innerJoin(facts, eq(skillFacts.factId, facts.id))
		.where(eq(skillFacts.skillId, skillRecord.id));

	const result: SkillGetOutput = {
		name: skillRecord.name,
		title: skillRecord.title,
		content,
		tags: skillTagsResult.map((t) => t.name),
		references: {
			skills: skillSkillsResult.map((s) => ({
				name: s.name,
				title: s.title,
				relation: s.relation,
			})),
			resources: skillResourcesResult.map((r) => ({
				id: r.id,
				uri: r.uri,
				isStale: r.currentHash !== r.linkHash,
			})),
			facts: skillFactsResult.map((f) => ({
				id: f.id,
				content: f.content,
			})),
		},
	};

	if (input.hydrateRefs) {
		const hydratedSkills = await Promise.all(
			skillSkillsResult.map(async (s) => {
				const refSkill = await db
					.select({ filePath: skills.filePath })
					.from(skills)
					.where(eq(skills.name, s.name))
					.limit(1);

				if (refSkill.length === 0) return null;

				// biome-ignore lint/style/noNonNullAssertion: guaranteed
				const refPath = refSkill[0]!.filePath;
				const content = (await fileExists(refPath))
					? await readTextFile(refPath)
					: "";

				return { name: s.name, content };
			}),
		);

		result.hydratedSkills = hydratedSkills.filter(
			(s): s is NonNullable<typeof s> => s !== null,
		);
	}

	return result;
}

export async function getSkills(
	db: DB,
	input: SkillsGetInput,
): Promise<SkillsGetOutput> {
	const results: SkillGetOutput[] = [];
	const notFound: string[] = [];

	for (const name of input.names) {
		const result = await getSkill(db, { name, hydrateRefs: input.hydrateRefs });
		if (result) {
			results.push(result);
		} else {
			notFound.push(name);
		}
	}

	return { skills: results, notFound };
}

export async function linkSkill(db: DB, input: SkillLinkInput): Promise<void> {
	const skill = await db
		.select({ id: skills.id })
		.from(skills)
		.where(eq(skills.name, input.skillName))
		.limit(1);

	if (skill.length === 0) {
		throw new Error(`Skill not found: ${input.skillName}`);
	}

	// biome-ignore lint/style/noNonNullAssertion: guaranteed
	const skillId = skill[0]!.id;

	if (input.linkSkills?.length) {
		const skillNames = input.linkSkills.map((l) => l.name);
		const refSkills = await db
			.select({ id: skills.id, name: skills.name })
			.from(skills)
			.where(inArray(skills.name, skillNames));

		const refMap = new Map(refSkills.map((s) => [s.name, s.id]));
		const values = input.linkSkills
			.filter((link) => refMap.has(link.name))
			.map((link) => ({
				skillId,
				// biome-ignore lint/style/noNonNullAssertion: guaranteed
				referencedSkillId: refMap.get(link.name)!,
				relationType: link.relation,
			}));

		if (values.length > 0) {
			await db.insert(skillSkills).values(values).onConflictDoNothing();
		}
	}

	if (input.linkResources?.length) {
		const refResources = await db
			.select({ id: resources.id, snapshotHash: resources.snapshotHash })
			.from(resources)
			.where(inArray(resources.id, input.linkResources));

		if (refResources.length > 0) {
			await db
				.insert(skillResources)
				.values(
					refResources.map((r) => ({
						skillId,
						resourceId: r.id,
						snapshotHashAtLink: r.snapshotHash,
					})),
				)
				.onConflictDoNothing();
		}
	}

	if (input.linkFacts?.length) {
		await db
			.insert(skillFacts)
			.values(
				input.linkFacts.map((factId) => ({
					skillId,
					factId,
				})),
			)
			.onConflictDoNothing();
	}
}

export async function getSkillById(db: DB, id: number) {
	const result = await db
		.select()
		.from(skills)
		.where(eq(skills.id, id))
		.limit(1);
	return result[0] ?? null;
}

/**
 * Auto-register a skill from an existing file in the skills directory.
 * Used by the file watcher to add skills that weren't created via create_skill.
 * These skills are flagged with needsReview=true for user review.
 * @param filePath - Path to the skill file (can be relative or absolute)
 */
export async function registerSkillFromFile(
	db: DB,
	filePath: string,
): Promise<{ id: number; name: string; isNew: boolean } | null> {
	// Normalize to relative path for storage
	const relativeFilePath = toRelativePath(filePath);

	const fileName = basename(relativeFilePath);
	if (!fileName.endsWith(".md")) {
		return null;
	}
	const name = fileName.replace(/\.md$/, "");

	const existing = await db
		.select({ id: skills.id, name: skills.name })
		.from(skills)
		.where(eq(skills.name, name))
		.limit(1);

	if (existing.length > 0) {
		return { id: existing[0]!.id, name, isNew: false };
	}

	// Use relative path - fileExists will resolve to absolute internally
	if (!(await fileExists(relativeFilePath))) {
		return null;
	}

	const content = await readTextFile(relativeFilePath);
	const contentHash = computeHash(content);

	const titleMatch = content.match(/^#\s+(.+)$/m);
	const title = titleMatch?.[1]?.trim() ?? name;

	// Store relative path in DB
	const result = await db
		.insert(skills)
		.values({
			name,
			title,
			filePath: relativeFilePath,
			contentHash,
			needsReview: true,
		})
		.returning({ id: skills.id });

	if (result.length === 0) {
		return null;
	}

	return { id: result[0]!.id, name, isNew: true };
}

/**
 * Get all skills that need review (auto-discovered, not created via tool)
 */
export async function getSkillsNeedingReview(
	db: DB,
): Promise<{ id: number; name: string; title: string; filePath: string }[]> {
	return await db
		.select({
			id: skills.id,
			name: skills.name,
			title: skills.title,
			filePath: skills.filePath,
		})
		.from(skills)
		.where(eq(skills.needsReview, true));
}

/**
 * Mark a skill as reviewed (clears the needsReview flag)
 */
export async function markSkillReviewed(
	db: DB,
	name: string,
): Promise<{ success: boolean }> {
	const result = await db
		.update(skills)
		.set({
			needsReview: false,
			updatedAt: sql`(CURRENT_TIMESTAMP)` as unknown as string,
		})
		.where(eq(skills.name, name))
		.returning({ id: skills.id });

	return { success: result.length > 0 };
}

/**
 * Update all skill file paths when skills directory changes.
 * Both oldDir and newDir should be relative paths.
 */
export async function migrateSkillPaths(
	db: DB,
	oldDir: string,
	newDir: string,
): Promise<{ migrated: number }> {
	const { join, basename } = await import("node:path");
	const { rename, mkdir } = await import("node:fs/promises");

	// Convert to absolute for file operations
	const absoluteNewDir = toAbsolutePath(newDir);
	await mkdir(absoluteNewDir, { recursive: true });

	const allSkills = await db.select().from(skills);

	let migrated = 0;
	for (const skill of allSkills) {
		// Check if stored path starts with old directory (both relative)
		if (skill.filePath.startsWith(oldDir)) {
			const fileName = basename(skill.filePath);
			const newRelativePath = join(newDir, fileName);

			try {
				// Use absolute paths for actual file operations
				const oldAbsolutePath = toAbsolutePath(skill.filePath);
				const newAbsolutePath = toAbsolutePath(newRelativePath);
				await rename(oldAbsolutePath, newAbsolutePath);
			} catch {
				// File may not exist or already moved, continue anyway
			}

			// Store relative path in DB
			await db
				.update(skills)
				.set({
					filePath: newRelativePath,
					updatedAt: sql`(CURRENT_TIMESTAMP)` as unknown as string,
				})
				.where(eq(skills.id, skill.id));

			migrated++;
		}
	}

	return { migrated };
}

export async function deleteSkills(
	db: DB,
	input: { names: string[]; deleteFiles?: boolean },
): Promise<{ deleted: number; filesDeleted: number }> {
	if (input.names.length === 0) {
		return { deleted: 0, filesDeleted: 0 };
	}

	const skillRecords = await db
		.select({ id: skills.id, name: skills.name, filePath: skills.filePath })
		.from(skills)
		.where(inArray(skills.name, input.names));

	if (skillRecords.length === 0) {
		return { deleted: 0, filesDeleted: 0 };
	}

	const skillIds = skillRecords.map((s) => s.id);

	// Delete junction table entries
	await db.delete(skillTags).where(inArray(skillTags.skillId, skillIds));
	await db.delete(skillSkills).where(inArray(skillSkills.skillId, skillIds));
	await db
		.delete(skillSkills)
		.where(inArray(skillSkills.referencedSkillId, skillIds));
	await db
		.delete(skillResources)
		.where(inArray(skillResources.skillId, skillIds));
	await db.delete(skillFacts).where(inArray(skillFacts.skillId, skillIds));

	// Delete skill records
	const result = await db
		.delete(skills)
		.where(inArray(skills.id, skillIds))
		.returning({ id: skills.id });

	// Optionally delete files
	let filesDeleted = 0;
	if (input.deleteFiles) {
		const { unlink } = await import("node:fs/promises");
		for (const skill of skillRecords) {
			try {
				// Convert relative path to absolute for file operation
				const absolutePath = toAbsolutePath(skill.filePath);
				await unlink(absolutePath);
				filesDeleted++;
			} catch {
				// File may not exist, ignore
			}
		}
	}

	return { deleted: result.length, filesDeleted };
}
