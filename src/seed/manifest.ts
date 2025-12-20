/**
 * Seed Manifest - Defines system-provided content for the knowledge base
 *
 * All system content uses the `factsets:system` tag and has unique systemIds.
 * Content is versioned via the manifest version number.
 */

export interface SeedTag {
	name: string;
	description?: string;
	systemId: string;
}

export interface SeedFact {
	content: string;
	source?: string;
	sourceType?: "user" | "documentation" | "code" | "inference";
	tags: string[];
	systemId: string;
	verified?: boolean;
}

export interface SeedSkill {
	name: string;
	title: string;
	description?: string;
	content: string;
	tags: string[];
	systemId: string;
}

export interface SeedManifest {
	version: number;
	tags: SeedTag[];
	facts: SeedFact[];
	skills: SeedSkill[];
}

/**
 * System seed manifest - pre-populated content for new installations
 */
export const seedManifest: SeedManifest = {
	version: 1,
	tags: [
		{
			name: "factsets:system",
			description:
				"System-provided content from Factsets. Do not remove this tag.",
			systemId: "factsets:tag:system",
		},
		{
			name: "getting-started",
			description: "Content to help new users get started with Factsets",
			systemId: "factsets:tag:getting-started",
		},
		{
			name: "best-practices",
			description:
				"Recommended patterns and practices for knowledge management",
			systemId: "factsets:tag:best-practices",
		},
		{
			name: "agent-workflow",
			description:
				"Guidelines for AI agent interaction with the knowledge base",
			systemId: "factsets:tag:agent-workflow",
		},
	],
	facts: [
		{
			content:
				"Facts should be atomic and self-contained. Each fact should express a single piece of information that can be understood without additional context.",
			source: "Factsets Documentation",
			sourceType: "documentation",
			tags: ["factsets:system", "best-practices"],
			systemId: "factsets:fact:atomic-facts",
			verified: true,
		},
		{
			content:
				"Use tags to create meaningful groupings. Tags like 'project-config', 'api-patterns', or 'debugging' help organize and retrieve related knowledge efficiently.",
			source: "Factsets Documentation",
			sourceType: "documentation",
			tags: ["factsets:system", "best-practices"],
			systemId: "factsets:fact:meaningful-tags",
			verified: true,
		},
		{
			content:
				"Skills are markdown documents that capture procedural knowledge. They can reference other skills, resources, and facts to create a connected knowledge graph.",
			source: "Factsets Documentation",
			sourceType: "documentation",
			tags: ["factsets:system", "getting-started"],
			systemId: "factsets:fact:skills-overview",
			verified: true,
		},
		{
			content:
				"Resources track external content like files, URLs, and API endpoints. They store snapshots and retrieval methods so agents can refresh content when needed.",
			source: "Factsets Documentation",
			sourceType: "documentation",
			tags: ["factsets:system", "getting-started"],
			systemId: "factsets:fact:resources-overview",
			verified: true,
		},
		{
			content:
				"The get_agent_guide tool provides comprehensive instructions for how agents should interact with the knowledge base. Call it first when starting a session.",
			source: "Factsets Documentation",
			sourceType: "documentation",
			tags: ["factsets:system", "agent-workflow"],
			systemId: "factsets:fact:agent-guide-tool",
			verified: true,
		},
		{
			content:
				"Use build_skill_context to retrieve a skill with all its related context. Set includeRefs=true to hydrate referenced skills for comprehensive understanding.",
			source: "Factsets Documentation",
			sourceType: "documentation",
			tags: ["factsets:system", "agent-workflow"],
			systemId: "factsets:fact:skill-context-tool",
			verified: true,
		},
		{
			content:
				"Tags with the 'factsets:system' prefix are managed by Factsets and should not be deleted. They are used for system-provided starter content.",
			source: "Factsets Documentation",
			sourceType: "documentation",
			tags: ["factsets:system", "getting-started"],
			systemId: "factsets:fact:system-tag-prefix",
			verified: true,
		},
		{
			content:
				"Verify facts after confirming their accuracy. Use verify_facts for specific IDs or verify_facts_by_tags to bulk-verify facts matching certain tags.",
			source: "Factsets Documentation",
			sourceType: "documentation",
			tags: ["factsets:system", "agent-workflow", "best-practices"],
			systemId: "factsets:fact:verify-facts-usage",
			verified: true,
		},
	],
	skills: [
		{
			name: "factsets-quickstart",
			title: "Factsets Quickstart Guide",
			description:
				"A beginner's guide to using Factsets for knowledge management",
			tags: ["factsets:system", "getting-started"],
			systemId: "factsets:skill:quickstart",
			content: `# Factsets Quickstart Guide

Welcome to Factsets! This guide will help you get started with building your knowledge base.

## Core Concepts

### Facts
Facts are atomic pieces of information. They should be:
- **Self-contained**: Understandable without additional context
- **Verifiable**: Can be marked as verified once confirmed
- **Tagged**: Associated with relevant tags for organization

### Tags
Tags organize your knowledge into meaningful groups. Good tag practices:
- Use descriptive names like \`project-config\`, \`api-patterns\`, \`debugging\`
- Create hierarchies with prefixes: \`auth:jwt\`, \`auth:oauth\`
- System tags use the \`factsets:system\` prefix

### Skills
Skills are markdown documents capturing procedural knowledge:
- How to perform specific tasks
- Best practices and patterns
- Workflows and processes

### Resources
Resources track external content:
- Files in your workspace
- URLs and documentation
- API endpoints
- Shell commands

## Getting Started Workflow

1. **Discover**: Use \`search_facts\`, \`search_skills\`, or \`list_tags\` to explore existing knowledge
2. **Retrieve**: Use \`build_skill_context\` or \`get_skill\` to get detailed information
3. **Contribute**: Add new facts with \`submit_facts\`, create skills with \`create_skill\`
4. **Maintain**: Verify facts, update stale content, sync skill files

## Agent Interaction

If you're an AI agent, call \`get_agent_guide\` first for comprehensive workflow instructions.

## Tips

- Start with facts for discrete information
- Graduate to skills for procedural knowledge
- Link skills to related facts, resources, and other skills
- Use tags consistently across your knowledge base
`,
		},
	],
};
