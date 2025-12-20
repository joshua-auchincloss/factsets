import { eq, lt, inArray } from "drizzle-orm";
import type { DB } from "../index.js";
import { facts, resources, skills, skillResources } from "../schema.js";
import type {
	CheckStaleInput,
	CheckStaleOutput,
} from "../../schemas/context.js";
import {
	daysSince,
	hoursAgoISO,
	hoursSince,
	nowISO,
} from "../../utils/dates.js";
import dayjs from "dayjs";

export async function checkStale(
	db: DB,
	input: CheckStaleInput,
): Promise<CheckStaleOutput> {
	const maxAgeHours = input.maxAgeHours ?? 168; // Default 7 days
	const cutoffIso = hoursAgoISO(maxAgeHours);

	const staleResources: CheckStaleOutput["staleResources"] = [];
	const staleSkills: CheckStaleOutput["staleSkills"] = [];
	const unverifiedFacts: CheckStaleOutput["unverifiedFacts"] = [];
	const skillsNeedingReview: CheckStaleOutput["skillsNeedingReview"] = [];

	if (input.checkResources !== false) {
		const resourceResults = await db
			.select({
				id: resources.id,
				uri: resources.uri,
				type: resources.type,
				lastVerifiedAt: resources.lastVerifiedAt,
				retrievalMethod: resources.retrievalMethod,
			})
			.from(resources)
			.where(lt(resources.lastVerifiedAt, cutoffIso));

		for (const r of resourceResults) {
			const daysStale = r.lastVerifiedAt ? daysSince(r.lastVerifiedAt) : 0;
			const hoursStale = r.lastVerifiedAt ? hoursSince(r.lastVerifiedAt) : 0;
			staleResources.push({
				id: r.id,
				uri: r.uri,
				type: r.type,
				lastVerifiedAt: r.lastVerifiedAt || undefined,
				daysStale,
				hoursStale,
				retrievalMethod: r.retrievalMethod,
			});
		}
	}

	if (input.checkSkills !== false) {
		const allSkills = await db
			.select({
				id: skills.id,
				name: skills.name,
				title: skills.title,
				filePath: skills.filePath,
				updatedAt: skills.updatedAt,
				needsReview: skills.needsReview,
			})
			.from(skills);

		for (const skill of allSkills) {
			// Check for skills needing review (auto-discovered)
			if (skill.needsReview) {
				skillsNeedingReview.push({
					id: skill.id,
					name: skill.name,
					title: skill.title,
					filePath: skill.filePath,
				});
			}

			const staleDependencies: CheckStaleOutput["staleSkills"][0]["staleDependencies"] =
				[];

			const resourceDeps = await db
				.select({
					resourceId: skillResources.resourceId,
					snapshotHashAtLink: skillResources.snapshotHashAtLink,
					currentHash: resources.snapshotHash,
					uri: resources.uri,
				})
				.from(skillResources)
				.innerJoin(resources, eq(skillResources.resourceId, resources.id))
				.where(eq(skillResources.skillId, skill.id));

			for (const dep of resourceDeps) {
				if (dep.snapshotHashAtLink !== dep.currentHash) {
					staleDependencies.push({
						type: "resource",
						id: dep.resourceId,
						name: dep.uri,
					});
				}
			}

			const skillUpdatedDate = dayjs(skill.updatedAt);
			const cutoffDate = dayjs(cutoffIso);
			if (skillUpdatedDate < cutoffDate && staleDependencies.length === 0) {
				staleSkills.push({
					id: skill.id,
					name: skill.name,
					reason: "not_updated",
					staleDependencies: [],
				});
			} else if (staleDependencies.length > 0) {
				staleSkills.push({
					id: skill.id,
					name: skill.name,
					reason: "resource_changed",
					staleDependencies,
				});
			}
		}
	}

	if (input.checkFacts !== false) {
		const factResults = await db
			.select({
				id: facts.id,
				content: facts.content,
				createdAt: facts.createdAt,
				sourceType: facts.sourceType,
			})
			.from(facts)
			.where(eq(facts.verified, false));

		for (const f of factResults) {
			const daysOld = daysSince(f.createdAt);
			const hoursOld = daysOld * 24;
			if (hoursOld >= maxAgeHours) {
				unverifiedFacts.push({
					id: f.id,
					content: f.content,
					daysOld,
					sourceType: f.sourceType ?? "unknown",
				});
			}
		}
	}

	return {
		staleResources,
		staleSkills,
		unverifiedFacts,
		skillsNeedingReview,
		summary: {
			totalStale:
				staleResources.length +
				staleSkills.length +
				unverifiedFacts.length +
				skillsNeedingReview.length,
			resources: staleResources.length,
			skills: staleSkills.length,
			facts: unverifiedFacts.length,
			pendingReview: skillsNeedingReview.length,
		},
	};
}

export async function markResourcesRefreshed(
	db: DB,
	resourceIds: number[],
): Promise<{
	affected: number;
	skillsToReview: { id: number; name: string }[];
}> {
	if (resourceIds.length === 0) {
		return { affected: 0, skillsToReview: [] };
	}

	await db
		.update(resources)
		.set({ lastVerifiedAt: nowISO() })
		.where(inArray(resources.id, resourceIds));

	const affectedSkills = await db
		.selectDistinct({
			id: skills.id,
			name: skills.name,
		})
		.from(skillResources)
		.innerJoin(skills, eq(skillResources.skillId, skills.id))
		.where(inArray(skillResources.resourceId, resourceIds));

	return {
		affected: resourceIds.length,
		skillsToReview: affectedSkills,
	};
}
