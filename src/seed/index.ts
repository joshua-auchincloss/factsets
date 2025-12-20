/**
 * Seed Loader - Applies system seed content to the knowledge base
 *
 * Uses upsert logic to:
 * - Insert new system content
 * - Update system content that hasn't been modified by the user
 * - Skip content that the user has modified (detected via hash mismatch)
 */

import { eq, sql, isNotNull } from "drizzle-orm";
import type { DB } from "../db/index.js";
import { tags, facts, factTags, skills, skillTags } from "../db/schema.js";
import { getConfig, setConfig } from "../db/operations/config.js";
import { getOrCreateTags } from "../db/operations/tags.js";
import { resolveSkillsDir } from "../db/operations/skills.js";
import { computeHash } from "../utils/hash.js";
import { writeTextFile, toAbsolutePath } from "../utils/fs.js";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SeedManifest, SeedTag, SeedFact, SeedSkill } from "./manifest.js";
import { seedManifest } from "./manifest.js";

const SEED_VERSION_KEY = "system_seed_version";

export interface SeedResult {
	version: number;
	tags: { created: number; updated: number; skipped: number };
	facts: { created: number; updated: number; skipped: number };
	skills: { created: number; updated: number; skipped: number };
}

/**
 * Apply seed content to the database
 *
 * @param db - Database connection
 * @param manifest - Seed manifest to apply (defaults to built-in manifest)
 * @returns Result summary
 */
export async function applySeed(
	db: DB,
	manifest: SeedManifest = seedManifest,
): Promise<SeedResult> {
	const currentVersion = await getConfig(db, SEED_VERSION_KEY);
	const currentVersionNum = currentVersion ? parseInt(currentVersion, 10) : 0;

	// Skip if already at or past this version
	if (currentVersionNum >= manifest.version) {
		return {
			version: manifest.version,
			tags: { created: 0, updated: 0, skipped: 0 },
			facts: { created: 0, updated: 0, skipped: 0 },
			skills: { created: 0, updated: 0, skipped: 0 },
		};
	}

	const tagResult = await seedTags(db, manifest.tags);
	const factResult = await seedFacts(db, manifest.facts);
	const skillResult = await seedSkills(db, manifest.skills);

	// Update version
	await setConfig(db, SEED_VERSION_KEY, manifest.version.toString());

	return {
		version: manifest.version,
		tags: tagResult,
		facts: factResult,
		skills: skillResult,
	};
}

async function seedTags(
	db: DB,
	seedTags: SeedTag[],
): Promise<{ created: number; updated: number; skipped: number }> {
	let created = 0;
	let updated = 0;
	let skipped = 0;

	for (const seedTag of seedTags) {
		// Check if tag exists by systemId
		const existing = await db
			.select()
			.from(tags)
			.where(eq(tags.systemId, seedTag.systemId))
			.limit(1);

		if (existing.length === 0) {
			// Check if tag exists by name (user might have created it)
			const byName = await db
				.select()
				.from(tags)
				.where(eq(tags.name, seedTag.name))
				.limit(1);

			if (byName.length > 0) {
				// Tag exists by name but not systemId - claim it as system tag
				await db
					.update(tags)
					.set({
						systemId: seedTag.systemId,
						description: seedTag.description ?? byName[0]!.description,
						updatedAt: sql`(CURRENT_TIMESTAMP)`,
					})
					.where(eq(tags.name, seedTag.name));
				updated++;
			} else {
				// Create new tag
				await db.insert(tags).values({
					name: seedTag.name,
					description: seedTag.description,
					systemId: seedTag.systemId,
				});
				created++;
			}
		} else {
			// Tag exists by systemId - update description if changed
			if (
				seedTag.description &&
				existing[0]!.description !== seedTag.description
			) {
				await db
					.update(tags)
					.set({
						description: seedTag.description,
						updatedAt: sql`(CURRENT_TIMESTAMP)`,
					})
					.where(eq(tags.systemId, seedTag.systemId));
				updated++;
			} else {
				skipped++;
			}
		}
	}

	return { created, updated, skipped };
}

async function seedFacts(
	db: DB,
	seedFacts: SeedFact[],
): Promise<{ created: number; updated: number; skipped: number }> {
	let created = 0;
	let updated = 0;
	let skipped = 0;

	for (const seedFact of seedFacts) {
		const contentHash = computeHash(seedFact.content);

		// Check if fact exists by systemId
		const existing = await db
			.select()
			.from(facts)
			.where(eq(facts.systemId, seedFact.systemId))
			.limit(1);

		if (existing.length === 0) {
			// Check if fact exists by exact content match
			const byContent = await db
				.select()
				.from(facts)
				.where(eq(facts.content, seedFact.content))
				.limit(1);

			let factId: number;

			if (byContent.length > 0) {
				// Content exists but no systemId - claim it
				await db
					.update(facts)
					.set({
						systemId: seedFact.systemId,
						systemHash: contentHash,
						source: seedFact.source,
						sourceType: seedFact.sourceType,
						verified: seedFact.verified ?? false,
						updatedAt: sql`(CURRENT_TIMESTAMP)`,
					})
					.where(eq(facts.content, seedFact.content));
				factId = byContent[0]!.id;
				updated++;
			} else {
				// Create new fact
				const result = await db
					.insert(facts)
					.values({
						content: seedFact.content,
						source: seedFact.source,
						sourceType: seedFact.sourceType,
						verified: seedFact.verified ?? false,
						systemId: seedFact.systemId,
						systemHash: contentHash,
					})
					.returning({ id: facts.id });
				factId = result[0]!.id;
				created++;
			}

			// Link tags
			if (seedFact.tags.length > 0) {
				const tagMap = await getOrCreateTags(db, seedFact.tags);
				await db
					.insert(factTags)
					.values(
						Array.from(tagMap.values()).map((tagId) => ({ factId, tagId })),
					)
					.onConflictDoNothing();
			}
		} else {
			// Fact exists by systemId
			const existingFact = existing[0]!;

			// Check if user has modified it (hash mismatch)
			if (existingFact.systemHash !== contentHash) {
				// Our content has changed - check if user modified it
				const currentContentHash = computeHash(existingFact.content);
				if (currentContentHash === existingFact.systemHash) {
					// User hasn't modified - safe to update
					await db
						.update(facts)
						.set({
							content: seedFact.content,
							systemHash: contentHash,
							source: seedFact.source,
							sourceType: seedFact.sourceType,
							verified: seedFact.verified ?? existingFact.verified,
							updatedAt: sql`(CURRENT_TIMESTAMP)`,
						})
						.where(eq(facts.systemId, seedFact.systemId));
					updated++;
				} else {
					// User modified content - skip update
					skipped++;
				}
			} else {
				skipped++;
			}
		}
	}

	return { created, updated, skipped };
}

async function seedSkills(
	db: DB,
	seedSkills: SeedSkill[],
): Promise<{ created: number; updated: number; skipped: number }> {
	let created = 0;
	let updated = 0;
	let skipped = 0;

	const skillsDir = await resolveSkillsDir(db);

	for (const seedSkill of seedSkills) {
		const contentHash = computeHash(seedSkill.content);
		const filePath = join(skillsDir, `${seedSkill.name}.md`);

		// Check if skill exists by systemId
		const existing = await db
			.select()
			.from(skills)
			.where(eq(skills.systemId, seedSkill.systemId))
			.limit(1);

		if (existing.length === 0) {
			// Check if skill exists by name
			const byName = await db
				.select()
				.from(skills)
				.where(eq(skills.name, seedSkill.name))
				.limit(1);

			let skillId: number;

			if (byName.length > 0) {
				// Skill exists by name but no systemId - claim it
				await db
					.update(skills)
					.set({
						systemId: seedSkill.systemId,
						systemHash: contentHash,
						title: seedSkill.title,
						description: seedSkill.description,
						updatedAt: sql`(CURRENT_TIMESTAMP)`,
					})
					.where(eq(skills.name, seedSkill.name));
				skillId = byName[0]!.id;
				updated++;
			} else {
				// Create new skill
				await mkdir(dirname(toAbsolutePath(filePath)), { recursive: true });
				await writeTextFile(filePath, seedSkill.content);

				const result = await db
					.insert(skills)
					.values({
						name: seedSkill.name,
						title: seedSkill.title,
						description: seedSkill.description,
						filePath,
						contentHash,
						systemId: seedSkill.systemId,
						systemHash: contentHash,
					})
					.returning({ id: skills.id });
				skillId = result[0]!.id;
				created++;
			}

			// Link tags
			if (seedSkill.tags.length > 0) {
				const tagMap = await getOrCreateTags(db, seedSkill.tags);
				await db
					.insert(skillTags)
					.values(
						Array.from(tagMap.values()).map((tagId) => ({ skillId, tagId })),
					)
					.onConflictDoNothing();
			}
		} else {
			// Skill exists by systemId
			const existingSkill = existing[0]!;

			// Check if our content changed and user hasn't modified
			if (existingSkill.systemHash !== contentHash) {
				// Our content changed - check if user modified
				if (existingSkill.contentHash === existingSkill.systemHash) {
					// User hasn't modified file - safe to update
					await mkdir(dirname(toAbsolutePath(filePath)), { recursive: true });
					await writeTextFile(filePath, seedSkill.content);

					await db
						.update(skills)
						.set({
							title: seedSkill.title,
							description: seedSkill.description,
							contentHash,
							systemHash: contentHash,
							updatedAt: sql`(CURRENT_TIMESTAMP)`,
						})
						.where(eq(skills.systemId, seedSkill.systemId));
					updated++;
				} else {
					// User modified skill - skip
					skipped++;
				}
			} else {
				skipped++;
			}
		}
	}

	return { created, updated, skipped };
}

/**
 * Check if seeding has been applied at the given version
 */
export async function getSeedVersion(db: DB): Promise<number> {
	const version = await getConfig(db, SEED_VERSION_KEY);
	return version ? parseInt(version, 10) : 0;
}

/**
 * Get all system-managed content (has systemId)
 */
export async function getSystemContent(db: DB): Promise<{
	tags: { id: number; name: string; systemId: string }[];
	facts: { id: number; systemId: string }[];
	skills: { id: number; name: string; systemId: string }[];
}> {
	const systemTags = await db
		.select({ id: tags.id, name: tags.name, systemId: tags.systemId })
		.from(tags)
		.where(isNotNull(tags.systemId));

	const systemFacts = await db
		.select({ id: facts.id, systemId: facts.systemId })
		.from(facts)
		.where(isNotNull(facts.systemId));

	const systemSkills = await db
		.select({ id: skills.id, name: skills.name, systemId: skills.systemId })
		.from(skills)
		.where(isNotNull(skills.systemId));

	return {
		tags: systemTags as { id: number; name: string; systemId: string }[],
		facts: systemFacts as { id: number; systemId: string }[],
		skills: systemSkills as { id: number; name: string; systemId: string }[],
	};
}
