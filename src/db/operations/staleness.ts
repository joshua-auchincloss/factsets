import { eq, inArray } from "drizzle-orm";
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
import { needsDescriptionUpdate } from "../../constants.js";
import { getStalenessWarningThreshold } from "./config.js";
import dayjs from "dayjs";

export async function checkStale(
	db: DB,
	input: CheckStaleInput,
): Promise<CheckStaleOutput> {
	const maxAgeHours = input.maxAgeHours ?? 168; // Default 7 days
	const cutoffIso = hoursAgoISO(maxAgeHours);

	// Get staleness warning threshold from config (default 0.8 = 80%)
	const warningThreshold = await getStalenessWarningThreshold(db);
	const warningHours = maxAgeHours * warningThreshold;
	const warningCutoffIso = hoursAgoISO(warningHours);

	const staleResources: CheckStaleOutput["staleResources"] = [];
	const approachingStaleResources: CheckStaleOutput["approachingStaleResources"] =
		[];
	const staleSkills: CheckStaleOutput["staleSkills"] = [];
	const unverifiedFacts: CheckStaleOutput["unverifiedFacts"] = [];
	const skillsNeedingReview: CheckStaleOutput["skillsNeedingReview"] = [];
	const incompleteDescriptions: CheckStaleOutput["incompleteDescriptions"] = [];

	if (input.checkResources !== false) {
		const resourceResults = await db
			.select({
				id: resources.id,
				uri: resources.uri,
				type: resources.type,
				description: resources.description,
				lastVerifiedAt: resources.lastVerifiedAt,
				retrievalMethod: resources.retrievalMethod,
			})
			.from(resources);

		for (const r of resourceResults) {
			// Check for stale resources (past the cutoff)
			if (r.lastVerifiedAt && r.lastVerifiedAt < cutoffIso) {
				const daysStale = daysSince(r.lastVerifiedAt);
				const hoursStale = hoursSince(r.lastVerifiedAt);
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
			// Check for approaching stale (past warning threshold but not yet stale)
			else if (r.lastVerifiedAt && r.lastVerifiedAt < warningCutoffIso) {
				const hoursOld = hoursSince(r.lastVerifiedAt);
				const hoursUntilStale = maxAgeHours - hoursOld;
				const percentToStale = Math.round((hoursOld / maxAgeHours) * 100);
				approachingStaleResources.push({
					id: r.id,
					uri: r.uri,
					type: r.type,
					lastVerifiedAt: r.lastVerifiedAt || undefined,
					hoursUntilStale: Math.max(0, hoursUntilStale),
					percentToStale,
				});
			}

			// Check for placeholder descriptions
			if (needsDescriptionUpdate(r.description)) {
				incompleteDescriptions.push({
					type: "resource",
					id: r.id,
					name: r.uri,
					description: r.description,
				});
			}
		}
	}

	if (input.checkSkills !== false) {
		const allSkills = await db
			.select({
				id: skills.id,
				name: skills.name,
				title: skills.title,
				description: skills.description,
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

			// Check for placeholder descriptions
			if (needsDescriptionUpdate(skill.description)) {
				incompleteDescriptions.push({
					type: "skill",
					id: skill.id,
					name: skill.name,
					description: skill.description,
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
		approachingStaleResources,
		staleSkills,
		unverifiedFacts,
		skillsNeedingReview,
		incompleteDescriptions,
		summary: {
			totalStale:
				staleResources.length +
				staleSkills.length +
				unverifiedFacts.length +
				skillsNeedingReview.length +
				incompleteDescriptions.length,
			resources: staleResources.length,
			skills: staleSkills.length,
			facts: unverifiedFacts.length,
			pendingReview: skillsNeedingReview.length,
			incompleteDescriptions: incompleteDescriptions.length,
			approachingStaleResources: approachingStaleResources.length,
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
