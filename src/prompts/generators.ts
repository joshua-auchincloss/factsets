import type { DB } from "../db/index.js";
import { searchFacts } from "../db/operations/facts.js";
import { searchResources, getResource } from "../db/operations/resources.js";
import { getSkill, searchSkills } from "../db/operations/skills.js";
import { checkStale } from "../db/operations/staleness.js";
import type {
	KnowledgeContextInput,
	RecallSkillInput,
	MaintenanceReportInput,
	RefreshGuideInput,
} from "../schemas/prompts.js";

export interface KnowledgeContextResult {
	markdown: string;
	data: {
		tags: string[];
		factsCount: number;
		resourcesCount: number;
		skillsCount: number;
		hasStalenessWarnings: boolean;
	};
}

export interface RecallSkillResult {
	markdown: string;
	found: boolean;
	skillName: string;
}

export interface MaintenanceReportResult {
	markdown: string;
	summary: {
		totalStale: number;
		resources: number;
		skills: number;
		facts: number;
		pendingReview: number;
	};
}

export interface RefreshGuideResult {
	markdown: string;
	found: boolean;
	resourceId: number;
}

/**
 * Generate knowledge context markdown for given tags
 */
export async function generateKnowledgeContext(
	db: DB,
	input: KnowledgeContextInput,
): Promise<KnowledgeContextResult> {
	const {
		tags,
		maxFacts = 50,
		maxResources = 20,
		maxSkills = 10,
		includeStalenessWarnings = true,
	} = input;

	const [factsResult, resourcesResult, skillsResult] = await Promise.all([
		searchFacts(db, { tags, limit: maxFacts }),
		searchResources(db, { tags, limit: maxResources }),
		searchSkills(db, { tags, limit: maxSkills }),
	]);

	const sections: string[] = [];

	if (factsResult.facts.length > 0) {
		sections.push("## Known Facts\n");
		for (const fact of factsResult.facts) {
			const verifiedMark = fact.verified ? "✓" : "?";
			sections.push(
				`- [${verifiedMark}] ${fact.content} (tags: ${fact.tags.join(", ")})`,
			);
		}
		sections.push("");
	}

	if (resourcesResult.resources.length > 0) {
		sections.push("## Relevant Resources\n");
		for (const resource of resourcesResult.resources) {
			const snapshotInfo = resource.hasSnapshot
				? "has snapshot"
				: "no snapshot";
			sections.push(`- [${resource.type}] ${resource.uri} (${snapshotInfo})`);
			if (resource.snapshotPreview) {
				sections.push(
					`  Preview: ${resource.snapshotPreview.slice(0, 100)}...`,
				);
			}
		}
		sections.push("");
	}

	if (skillsResult.skills.length > 0) {
		sections.push("## Available Skills\n");
		for (const skill of skillsResult.skills) {
			const staleWarning = skill.hasStaleDeps
				? " ⚠️ has stale dependencies"
				: "";
			sections.push(`- **${skill.title}** (${skill.name})${staleWarning}`);
			if (skill.description) {
				sections.push(`  ${skill.description}`);
			}
		}
		sections.push("");
	}

	if (sections.length === 0) {
		sections.push("No knowledge found for the specified tags.");
	}

	let hasStalenessWarnings = false;

	// Add staleness warnings if enabled
	if (includeStalenessWarnings) {
		const staleness = await checkStale(db, {
			checkResources: true,
			checkSkills: true,
			checkFacts: true,
			maxAgeHours: 168, // 7 days
		});

		if (staleness.summary.totalStale > 0) {
			hasStalenessWarnings = true;
			sections.push("## Staleness Warnings\n");

			if (staleness.staleResources.length > 0) {
				sections.push(
					`### Stale Resources (${staleness.staleResources.length})`,
				);
				for (const r of staleness.staleResources.slice(0, 5)) {
					sections.push(`- ${r.uri} (${r.daysStale} days stale)`);
				}
				if (staleness.staleResources.length > 5) {
					sections.push(
						`  ... and ${staleness.staleResources.length - 5} more`,
					);
				}
				sections.push("");
			}

			if (staleness.staleSkills.length > 0) {
				sections.push(
					`### Skills with Stale Dependencies (${staleness.staleSkills.length})`,
				);
				for (const s of staleness.staleSkills.slice(0, 5)) {
					sections.push(`- ${s.name} (${s.reason})`);
				}
				if (staleness.staleSkills.length > 5) {
					sections.push(`  ... and ${staleness.staleSkills.length - 5} more`);
				}
				sections.push("");
			}

			if (staleness.unverifiedFacts.length > 0) {
				sections.push(
					`### Unverified Facts (${staleness.unverifiedFacts.length})`,
				);
				sections.push("Consider verifying these facts before relying on them.");
				sections.push("");
			}
		}
	}

	const markdown = `# Knowledge Context for: ${tags.join(", ")}\n\n${sections.join("\n")}`;

	return {
		markdown,
		data: {
			tags,
			factsCount: factsResult.facts.length,
			resourcesCount: resourcesResult.resources.length,
			skillsCount: skillsResult.skills.length,
			hasStalenessWarnings,
		},
	};
}

/**
 * Generate skill recall markdown with content and references
 */
export async function generateRecallSkill(
	db: DB,
	input: RecallSkillInput,
): Promise<RecallSkillResult> {
	const { name, includeRefs = false } = input;
	const skill = await getSkill(db, { name, hydrateRefs: includeRefs });

	if (!skill) {
		return {
			markdown: `Skill "${name}" not found.`,
			found: false,
			skillName: name,
		};
	}

	const sections: string[] = [];
	sections.push(`# ${skill.title}\n`);
	sections.push(`Tags: ${skill.tags.join(", ")}\n`);
	sections.push("## Content\n");
	sections.push(skill.content);
	sections.push("");

	if (skill.references.skills.length > 0) {
		sections.push("## Referenced Skills\n");
		for (const ref of skill.references.skills) {
			sections.push(`- **${ref.title}** (${ref.name}) - ${ref.relation}`);
		}
		sections.push("");
	}

	if (skill.references.resources.length > 0) {
		sections.push("## Referenced Resources\n");
		for (const ref of skill.references.resources) {
			const staleWarning = ref.isStale ? " ⚠️ STALE" : "";
			sections.push(`- ${ref.uri}${staleWarning}`);
		}
		sections.push("");
	}

	if (skill.references.facts.length > 0) {
		sections.push("## Referenced Facts\n");
		for (const ref of skill.references.facts) {
			sections.push(`- ${ref.content}`);
		}
		sections.push("");
	}

	if (includeRefs && skill.hydratedSkills?.length) {
		sections.push("## Hydrated Skill Content\n");
		for (const hydrated of skill.hydratedSkills) {
			sections.push(`### ${hydrated.name}\n`);
			sections.push(hydrated.content);
			sections.push("");
		}
	}

	return {
		markdown: sections.join("\n"),
		found: true,
		skillName: name,
	};
}

/**
 * Generate maintenance report markdown
 */
export async function generateMaintenanceReport(
	db: DB,
	input: MaintenanceReportInput,
): Promise<MaintenanceReportResult> {
	const maxAgeHours = input.maxAgeHours ?? 168; // Default 7 days
	const result = await checkStale(db, { maxAgeHours });

	const sections: string[] = [];
	sections.push(`# Knowledge Base Maintenance Report\n`);
	sections.push(
		`Stale threshold: ${maxAgeHours} hours (${Math.round(maxAgeHours / 24)} days)\n`,
	);
	sections.push(
		`**Summary:** ${result.summary.totalStale} items need attention\n`,
	);
	sections.push(`- Resources: ${result.summary.resources}`);
	sections.push(`- Skills: ${result.summary.skills}`);
	sections.push(`- Unverified Facts: ${result.summary.facts}`);
	sections.push(`- Skills Pending Review: ${result.summary.pendingReview}`);
	sections.push("");

	if (result.staleResources.length > 0) {
		sections.push("## Stale Resources\n");
		sections.push(
			"These resources have not been verified recently and should be refreshed:\n",
		);
		for (const resource of result.staleResources) {
			sections.push(`### ${resource.uri}`);
			sections.push(`- Type: ${resource.type}`);
			sections.push(`- Days stale: ${resource.daysStale}`);
			sections.push(`- Last verified: ${resource.lastVerifiedAt}`);
			if (resource.retrievalMethod) {
				sections.push(`- Retrieval: ${resource.retrievalMethod.type}`);
				if (resource.retrievalMethod.command) {
					sections.push(`  - Command: \`${resource.retrievalMethod.command}\``);
				}
				if (resource.retrievalMethod.url) {
					sections.push(`  - URL: ${resource.retrievalMethod.url}`);
				}
			}
			sections.push("");
		}
	}

	if (result.staleSkills.length > 0) {
		sections.push("## Skills Needing Review\n");
		sections.push("These skills have stale or changed dependencies:\n");
		for (const skill of result.staleSkills) {
			sections.push(`### ${skill.name}`);
			sections.push(`- Reason: ${skill.reason}`);
			if (skill.staleDependencies.length > 0) {
				sections.push("- Changed dependencies:");
				for (const dep of skill.staleDependencies) {
					sections.push(`  - [${dep.type}] ${dep.name}`);
				}
			}
			sections.push("");
		}
	}

	if (result.unverifiedFacts.length > 0) {
		sections.push("## Unverified Facts\n");
		sections.push(
			"These facts have not been verified and should be confirmed or removed:\n",
		);
		for (const fact of result.unverifiedFacts) {
			sections.push(`- **[${fact.daysOld}d old]** ${fact.content}`);
			sections.push(`  - Source type: ${fact.sourceType}`);
		}
		sections.push("");
	}

	if (result.skillsNeedingReview.length > 0) {
		sections.push("## Skills Pending Review\n");
		sections.push(
			"These skills were auto-discovered from files and need to be reviewed:\n",
		);
		sections.push(
			"Use `update_skill` to add tags, description, and references, then the skill will be marked as reviewed.\n",
		);
		for (const skill of result.skillsNeedingReview) {
			sections.push(`### ${skill.name}`);
			sections.push(`- Title: ${skill.title}`);
			sections.push(`- File: ${skill.filePath}`);
			sections.push(
				"- Action: Review content, add tags and description via `update_skill`",
			);
			sections.push("");
		}
	}

	if (result.summary.totalStale === 0) {
		sections.push("## All Clear\n");
		sections.push("No stale content found. Your knowledge base is up to date.");
	}

	return {
		markdown: sections.join("\n"),
		summary: result.summary,
	};
}

/**
 * Generate refresh guide markdown for a specific resource
 */
export async function generateRefreshGuide(
	db: DB,
	input: RefreshGuideInput,
): Promise<RefreshGuideResult> {
	const { resourceId } = input;
	const resource = await getResource(db, { id: resourceId });

	if (!resource) {
		return {
			markdown: `Resource with ID ${resourceId} not found.`,
			found: false,
			resourceId,
		};
	}

	const sections: string[] = [];
	sections.push(`# Refresh Guide: ${resource.uri}\n`);
	sections.push(`**Type:** ${resource.type}`);
	sections.push(
		`**Current snapshot age:** ${Math.floor(resource.snapshotAgeSeconds / 3600)} hours`,
	);
	sections.push(`**Is fresh:** ${resource.isFresh ? "Yes" : "No"}`);
	sections.push("");

	sections.push("## How to Refresh\n");

	if (!resource.retrievalMethod) {
		sections.push(
			"No retrieval method is stored for this resource. You will need to manually fetch the content based on the URI and type.\n",
		);
	} else {
		switch (resource.retrievalMethod.type) {
			case "file":
				sections.push(`1. Read the file at: \`${resource.uri}\``);
				sections.push(
					"2. Use the `update_resource_snapshot` tool with the new content",
				);
				break;
			case "url":
				sections.push(
					`1. Fetch the URL: ${resource.retrievalMethod.url ?? resource.uri}`,
				);
				if (resource.retrievalMethod.headers) {
					sections.push("2. Include these headers:");
					for (const [key, value] of Object.entries(
						resource.retrievalMethod.headers,
					)) {
						sections.push(`   - ${key}: ${value}`);
					}
				}
				sections.push(
					"3. Use the `update_resource_snapshot` tool with the fetched content",
				);
				break;
			case "command":
				sections.push(
					`1. Run the command: \`${resource.retrievalMethod.command}\``,
				);
				sections.push(
					"2. Use the `update_resource_snapshot` tool with the command output",
				);
				break;
			case "api":
				sections.push(
					`1. Call the API: ${resource.retrievalMethod.url ?? resource.uri}`,
				);
				if (resource.retrievalMethod.headers) {
					sections.push("2. Include these headers:");
					for (const [key, value] of Object.entries(
						resource.retrievalMethod.headers,
					)) {
						sections.push(`   - ${key}: ${value}`);
					}
				}
				sections.push(
					"3. Use the `update_resource_snapshot` tool with the API response",
				);
				break;
			default:
				sections.push(`Retrieval type: ${resource.retrievalMethod.type}`);
				sections.push(
					"Follow the appropriate method for this type and update the snapshot.",
				);
		}
	}

	sections.push("");
	sections.push("## After Refreshing\n");
	sections.push("1. Review any skills that depend on this resource");
	sections.push("2. Update skills if the content has changed significantly");
	sections.push("3. Create new facts if you discovered new information");

	return {
		markdown: sections.join("\n"),
		found: true,
		resourceId,
	};
}
