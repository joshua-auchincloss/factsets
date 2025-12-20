import { inArray, sql } from "drizzle-orm";
import type { DB } from "../index.js";
import {
	facts,
	factTags,
	resources,
	resourceTags,
	skills,
	skillTags,
	tags,
} from "../schema.js";
import { incrementTagUsage } from "./tags.js";
import type { ContextBuildInput } from "../../schemas/context.js";
import { fileExists, readTextFile } from "../../utils/fs.js";

export async function buildContext(
	db: DB,
	input: ContextBuildInput,
): Promise<string | object> {
	const maxFacts = input.maxFacts ?? 30;
	const maxResources = input.maxResources ?? 10;
	const maxSkills = input.maxSkills ?? 5;

	const tagResults = await db
		.select({ id: tags.id, name: tags.name })
		.from(tags)
		.where(inArray(tags.name, input.tags));

	if (tagResults.length === 0) {
		return input.format === "json"
			? { facts: [], resources: [], skills: [] }
			: "No matching tags found.";
	}

	const tagIds = tagResults.map((t) => t.id);
	await incrementTagUsage(db, tagIds);

	const factsData: { id: number; content: string; tags: string[] }[] = [];
	const resourcesData: {
		id: number;
		uri: string;
		type: string;
		preview: string;
		tags: string[];
	}[] = [];
	const skillsData: {
		name: string;
		title: string;
		content: string;
		tags: string[];
	}[] = [];

	if (input.includeFacts !== false) {
		const factIds = await db
			.selectDistinct({ factId: factTags.factId })
			.from(factTags)
			.where(inArray(factTags.tagId, tagIds))
			.limit(maxFacts);

		if (factIds.length > 0) {
			const factResults = await db
				.select({
					id: facts.id,
					content: facts.content,
				})
				.from(facts)
				.where(
					inArray(
						facts.id,
						factIds.map((f) => f.factId),
					),
				);

			await db
				.update(facts)
				.set({
					retrievalCount: sql`${facts.retrievalCount} + 1`,
					lastRetrievedAt: sql`(CURRENT_TIMESTAMP)`,
				})
				.where(
					inArray(
						facts.id,
						factIds.map((f) => f.factId),
					),
				);

			for (const fact of factResults) {
				const factTagNames = await db
					.select({ name: tags.name })
					.from(factTags)
					.innerJoin(tags, sql`${factTags.tagId} = ${tags.id}`)
					.where(sql`${factTags.factId} = ${fact.id}`);

				factsData.push({
					id: fact.id,
					content: fact.content,
					tags: factTagNames.map((t) => t.name),
				});
			}
		}
	}

	if (input.includeResources !== false) {
		const resourceIds = await db
			.selectDistinct({ resourceId: resourceTags.resourceId })
			.from(resourceTags)
			.where(inArray(resourceTags.tagId, tagIds))
			.limit(maxResources);

		if (resourceIds.length > 0) {
			const resourceResults = await db
				.select({
					id: resources.id,
					uri: resources.uri,
					type: resources.type,
					snapshot: resources.snapshot,
				})
				.from(resources)
				.where(
					inArray(
						resources.id,
						resourceIds.map((r) => r.resourceId),
					),
				);

			await db
				.update(resources)
				.set({
					retrievalCount: sql`${resources.retrievalCount} + 1`,
				})
				.where(
					inArray(
						resources.id,
						resourceIds.map((r) => r.resourceId),
					),
				);

			for (const resource of resourceResults) {
				const resourceTagNames = await db
					.select({ name: tags.name })
					.from(resourceTags)
					.innerJoin(tags, sql`${resourceTags.tagId} = ${tags.id}`)
					.where(sql`${resourceTags.resourceId} = ${resource.id}`);

				resourcesData.push({
					id: resource.id,
					uri: resource.uri,
					type: resource.type,
					preview: resource.snapshot?.slice(0, 200) ?? "",
					tags: resourceTagNames.map((t) => t.name),
				});
			}
		}
	}

	if (input.includeSkills !== false) {
		const skillIds = await db
			.selectDistinct({ skillId: skillTags.skillId })
			.from(skillTags)
			.where(inArray(skillTags.tagId, tagIds))
			.limit(maxSkills);

		if (skillIds.length > 0) {
			const skillResults = await db
				.select({
					id: skills.id,
					name: skills.name,
					title: skills.title,
					filePath: skills.filePath,
				})
				.from(skills)
				.where(
					inArray(
						skills.id,
						skillIds.map((s) => s.skillId),
					),
				);

			await db
				.update(skills)
				.set({
					retrievalCount: sql`${skills.retrievalCount} + 1`,
					lastRetrievedAt: sql`(CURRENT_TIMESTAMP)`,
				})
				.where(
					inArray(
						skills.id,
						skillIds.map((s) => s.skillId),
					),
				);

			for (const skill of skillResults) {
				const skillTagNames = await db
					.select({ name: tags.name })
					.from(skillTags)
					.innerJoin(tags, sql`${skillTags.tagId} = ${tags.id}`)
					.where(sql`${skillTags.skillId} = ${skill.id}`);

				const content = (await fileExists(skill.filePath))
					? await readTextFile(skill.filePath)
					: "";

				skillsData.push({
					name: skill.name,
					title: skill.title,
					content,
					tags: skillTagNames.map((t) => t.name),
				});
			}
		}
	}

	if (input.format === "json") {
		return {
			facts: factsData,
			resources: resourcesData,
			skills: skillsData,
		};
	}

	const lines: string[] = [];

	if (factsData.length > 0) {
		lines.push("## Facts");
		for (const fact of factsData) {
			lines.push(`- [${fact.tags.join(",")}] ${fact.content}`);
		}
		lines.push("");
	}

	if (resourcesData.length > 0) {
		lines.push("## Resources");
		for (const resource of resourcesData) {
			lines.push(
				`- [${resource.type}:${resource.tags[0] ?? ""}] ${resource.uri} (${resource.preview}...)`,
			);
		}
		lines.push("");
	}

	if (skillsData.length > 0) {
		lines.push("## Skills");
		for (const skill of skillsData) {
			lines.push(`### ${skill.title}`);
			lines.push(skill.content);
			lines.push("");
		}
	}

	return lines.join("\n");
}
