import type { CommandHandler } from "./types.js";
import { createConnection, runMigrations } from "../db/index.js";
import { PLACEHOLDER_DESCRIPTION } from "../constants.js";
import {
	tags,
	facts,
	factTags,
	resources,
	resourceTags,
	skills,
	skillTags,
	skillSkills,
	skillResources,
	skillFacts,
} from "../db/schema.js";
import { eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import dayjs from "dayjs";
import { fileExists, readTextFile, writeTextFile } from "../utils/fs.js";
import { computeHash } from "../utils/hash.js";

type DumpHandler = CommandHandler<"dump">;
type RestoreHandler = CommandHandler<"restore">;

interface DumpOutput {
	exportedAt: string;
	tags: Array<{
		id: number;
		name: string;
		description: string;
		usageCount: number;
	}>;
	facts: Array<{
		id: number;
		content: string;
		source: string | null;
		sourceType: string | null;
		verified: boolean;
		tags: string[];
		createdAt: string;
		updatedAt: string;
	}>;
	resources: Array<{
		id: number;
		uri: string;
		type: string;
		description?: string | null;
		snapshot: string | null;
		retrievalMethod: unknown | null;
		tags: string[];
		lastVerifiedAt: string | null;
		createdAt: string;
		updatedAt: string;
	}>;
	skills: Array<{
		id: number;
		name: string;
		title: string;
		description: string | null;
		filePath: string;
		content: string | null;
		tags: string[];
		references: {
			skills: Array<{ name: string; relation: string }>;
			resources: number[];
			facts: number[];
		};
		createdAt: string;
		updatedAt: string;
	}>;
}

export const dumpHandler: DumpHandler = async (cfg) => {
	const db = createConnection(cfg.databaseUrl);
	await runMigrations(db);

	// Get all tags
	const allTags = await db.select().from(tags);
	const tagIdToName = new Map(allTags.map((t) => [t.id, t.name]));

	// Get all facts with their tags
	const allFacts = await db.select().from(facts);
	const allFactTags = await db.select().from(factTags);
	const factTagsMap = new Map<number, string[]>();
	for (const ft of allFactTags) {
		const existing = factTagsMap.get(ft.factId) ?? [];
		const tagName = tagIdToName.get(ft.tagId);
		if (tagName) existing.push(tagName);
		factTagsMap.set(ft.factId, existing);
	}

	// Get all resources with their tags
	const allResources = await db.select().from(resources);
	const allResourceTags = await db.select().from(resourceTags);
	const resourceTagsMap = new Map<number, string[]>();
	for (const rt of allResourceTags) {
		const existing = resourceTagsMap.get(rt.resourceId) ?? [];
		const tagName = tagIdToName.get(rt.tagId);
		if (tagName) existing.push(tagName);
		resourceTagsMap.set(rt.resourceId, existing);
	}

	// Get all skills with their tags and references
	const allSkills = await db.select().from(skills);
	const allSkillTags = await db.select().from(skillTags);
	const allSkillSkills = await db.select().from(skillSkills);
	const allSkillResources = await db.select().from(skillResources);
	const allSkillFacts = await db.select().from(skillFacts);

	const skillIdToName = new Map(allSkills.map((s) => [s.id, s.name]));
	const skillTagsMap = new Map<number, string[]>();
	for (const st of allSkillTags) {
		const existing = skillTagsMap.get(st.skillId) ?? [];
		const tagName = tagIdToName.get(st.tagId);
		if (tagName) existing.push(tagName);
		skillTagsMap.set(st.skillId, existing);
	}

	const skillRefsMap = new Map<
		number,
		{
			skills: Array<{ name: string; relation: string }>;
			resources: number[];
			facts: number[];
		}
	>();
	for (const skill of allSkills) {
		skillRefsMap.set(skill.id, { skills: [], resources: [], facts: [] });
	}
	for (const ss of allSkillSkills) {
		const refs = skillRefsMap.get(ss.skillId);
		const refName = skillIdToName.get(ss.referencedSkillId);
		if (refs && refName) {
			refs.skills.push({
				name: refName,
				relation: ss.relationType ?? "related",
			});
		}
	}
	for (const sr of allSkillResources) {
		const refs = skillRefsMap.get(sr.skillId);
		if (refs) refs.resources.push(sr.resourceId);
	}
	for (const sf of allSkillFacts) {
		const refs = skillRefsMap.get(sf.skillId);
		if (refs) refs.facts.push(sf.factId);
	}

	// Read skill file contents
	const skillContents = new Map<number, string | null>();
	for (const skill of allSkills) {
		try {
			if (await fileExists(skill.filePath)) {
				skillContents.set(skill.id, await readTextFile(skill.filePath));
			} else {
				skillContents.set(skill.id, null);
			}
		} catch {
			skillContents.set(skill.id, null);
		}
	}

	const output: DumpOutput = {
		exportedAt: dayjs().toISOString(),
		tags: allTags.map((t) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			usageCount: t.usageCount,
		})),
		facts: allFacts.map((f) => ({
			id: f.id,
			content: f.content,
			source: f.source,
			sourceType: f.sourceType,
			verified: f.verified,
			tags: factTagsMap.get(f.id) ?? [],
			createdAt: f.createdAt,
			updatedAt: f.updatedAt,
		})),
		resources: allResources.map((r) => ({
			id: r.id,
			uri: r.uri,
			type: r.type,
			description: r.description,
			snapshot: r.snapshot,
			retrievalMethod: r.retrievalMethod,
			tags: resourceTagsMap.get(r.id) ?? [],
			lastVerifiedAt: r.lastVerifiedAt,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
		})),
		skills: allSkills.map((s) => ({
			id: s.id,
			name: s.name,
			title: s.title,
			description: s.description,
			filePath: s.filePath,
			content: skillContents.get(s.id) ?? null,
			tags: skillTagsMap.get(s.id) ?? [],
			references: skillRefsMap.get(s.id) ?? {
				skills: [],
				resources: [],
				facts: [],
			},
			createdAt: s.createdAt,
			updatedAt: s.updatedAt,
		})),
	};

	await writeTextFile(cfg.outputFile, JSON.stringify(output, null, 2));

	console.log(`Exported to ${cfg.outputFile}:`);
	console.log(`  - ${output.tags.length} tags`);
	console.log(`  - ${output.facts.length} facts`);
	console.log(`  - ${output.resources.length} resources`);
	console.log(`  - ${output.skills.length} skills`);
};

export const restoreHandler: RestoreHandler = async (cfg) => {
	const db = createConnection(cfg.databaseUrl);
	await runMigrations(db);

	if (!(await fileExists(cfg.inputFile))) {
		throw new Error(`Input file not found: ${cfg.inputFile}`);
	}

	const input: DumpOutput = JSON.parse(await readTextFile(cfg.inputFile));

	console.log(
		`Restoring from ${cfg.inputFile} (exported ${input.exportedAt})...`,
	);

	const oldTagIdToNew = new Map<number, number>();
	const oldFactIdToNew = new Map<number, number>();
	const oldResourceIdToNew = new Map<number, number>();
	const oldSkillIdToNew = new Map<number, number>();
	const skillNameToNewId = new Map<string, number>();

	for (const tag of input.tags) {
		const existing = await db
			.select()
			.from(tags)
			.where(eq(tags.name, tag.name))
			.limit(1);
		if (existing.length > 0) {
			oldTagIdToNew.set(tag.id, existing[0]!.id);
		} else {
			const [inserted] = await db
				.insert(tags)
				.values({
					name: tag.name,
					description: tag.description,
					usageCount: tag.usageCount,
				})
				.returning({ id: tags.id });
			if (inserted) oldTagIdToNew.set(tag.id, inserted.id);
		}
	}
	console.log(`  - Restored ${input.tags.length} tags`);

	const tagNameToNewId = new Map<string, number>();
	for (const tag of input.tags) {
		const newId = oldTagIdToNew.get(tag.id);
		if (newId) tagNameToNewId.set(tag.name, newId);
	}

	for (const fact of input.facts) {
		const existing = await db
			.select()
			.from(facts)
			.where(eq(facts.content, fact.content))
			.limit(1);
		let factId: number;
		if (existing.length > 0) {
			factId = existing[0]!.id;
		} else {
			const [inserted] = await db
				.insert(facts)
				.values({
					content: fact.content,
					source: fact.source,
					sourceType: fact.sourceType,
					verified: fact.verified,
				})
				.returning({ id: facts.id });
			factId = inserted!.id;
		}
		oldFactIdToNew.set(fact.id, factId);

		// Restore fact tags
		for (const tagName of fact.tags) {
			const tagId = tagNameToNewId.get(tagName);
			if (tagId) {
				await db
					.insert(factTags)
					.values({ factId, tagId })
					.onConflictDoNothing();
			}
		}
	}
	console.log(`  - Restored ${input.facts.length} facts`);

	for (const resource of input.resources) {
		const existing = await db
			.select()
			.from(resources)
			.where(eq(resources.uri, resource.uri))
			.limit(1);
		let resourceId: number;
		if (existing.length > 0) {
			resourceId = existing[0]!.id;
		} else {
			const [inserted] = await db
				.insert(resources)
				.values({
					uri: resource.uri,
					type: resource.type,
					description: resource.description ?? PLACEHOLDER_DESCRIPTION,
					snapshot: resource.snapshot,
					snapshotHash: resource.snapshot
						? computeHash(resource.snapshot)
						: null,
					retrievalMethod:
						resource.retrievalMethod as typeof resources.retrievalMethod._.data,
					lastVerifiedAt: resource.lastVerifiedAt,
				})
				.returning({ id: resources.id });
			resourceId = inserted!.id;
		}
		oldResourceIdToNew.set(resource.id, resourceId);

		for (const tagName of resource.tags) {
			const tagId = tagNameToNewId.get(tagName);
			if (tagId) {
				await db
					.insert(resourceTags)
					.values({ resourceId, tagId })
					.onConflictDoNothing();
			}
		}
	}
	console.log(`  - Restored ${input.resources.length} resources`);

	for (const skill of input.skills) {
		const existing = await db
			.select()
			.from(skills)
			.where(eq(skills.name, skill.name))
			.limit(1);
		let skillId: number;
		let filePath = skill.filePath;

		if (existing.length > 0) {
			skillId = existing[0]!.id;
			filePath = existing[0]!.filePath;
		} else {
			if (skill.content) {
				await mkdir(dirname(filePath), { recursive: true });
				await writeTextFile(filePath, skill.content);
			}

			const [inserted] = await db
				.insert(skills)
				.values({
					name: skill.name,
					title: skill.title,
					description: skill.description ?? PLACEHOLDER_DESCRIPTION,
					filePath,
					contentHash: skill.content ? computeHash(skill.content) : null,
				})
				.returning({ id: skills.id });
			skillId = inserted!.id;
		}
		oldSkillIdToNew.set(skill.id, skillId);
		skillNameToNewId.set(skill.name, skillId);

		for (const tagName of skill.tags) {
			const tagId = tagNameToNewId.get(tagName);
			if (tagId) {
				await db
					.insert(skillTags)
					.values({ skillId, tagId })
					.onConflictDoNothing();
			}
		}
	}
	console.log(`  - Restored ${input.skills.length} skills`);

	for (const skill of input.skills) {
		const skillId = oldSkillIdToNew.get(skill.id);
		if (!skillId) continue;

		for (const ref of skill.references.skills) {
			const referencedSkillId = skillNameToNewId.get(ref.name);
			if (referencedSkillId) {
				await db
					.insert(skillSkills)
					.values({
						skillId,
						referencedSkillId,
						relationType: ref.relation,
					})
					.onConflictDoNothing();
			}
		}

		for (const oldResourceId of skill.references.resources) {
			const resourceId = oldResourceIdToNew.get(oldResourceId);
			if (resourceId) {
				const resource = await db
					.select({ snapshotHash: resources.snapshotHash })
					.from(resources)
					.where(eq(resources.id, resourceId))
					.limit(1);
				await db
					.insert(skillResources)
					.values({
						skillId,
						resourceId,
						snapshotHashAtLink: resource[0]?.snapshotHash ?? null,
					})
					.onConflictDoNothing();
			}
		}

		for (const oldFactId of skill.references.facts) {
			const factId = oldFactIdToNew.get(oldFactId);
			if (factId) {
				await db
					.insert(skillFacts)
					.values({ skillId, factId })
					.onConflictDoNothing();
			}
		}
	}
	console.log(`  - Restored skill references`);

	console.log(`Restore complete.`);
};
