import type { FactSubmitInput } from "../src/schemas/facts";
import type { ResourceAddInput } from "../src/schemas/resources";
import type { SkillCreateInput } from "../src/schemas/skills";

let counter = 0;
const uniqueId = () => ++counter;

export const factories = {
	fact: (
		overrides?: Partial<FactSubmitInput["facts"][0]>,
	): FactSubmitInput["facts"][0] => ({
		content: `Test fact ${uniqueId()}`,
		tags: ["test"],
		verified: false,
		...overrides,
	}),

	facts: (
		count: number,
		overrides?: Partial<FactSubmitInput["facts"][0]>,
	): FactSubmitInput["facts"] =>
		Array.from({ length: count }, () => factories.fact(overrides)),

	resource: (
		overrides?: Partial<ResourceAddInput["resources"][0]>,
	): ResourceAddInput["resources"][0] => ({
		uri: `file:///test/file-${uniqueId()}.ts`,
		type: "file",
		tags: ["test"],
		...overrides,
	}),

	resources: (
		count: number,
		overrides?: Partial<ResourceAddInput["resources"][0]>,
	): ResourceAddInput["resources"] =>
		Array.from({ length: count }, () => factories.resource(overrides)),

	skill: (overrides?: Partial<SkillCreateInput>): SkillCreateInput => ({
		name: `test-skill-${uniqueId()}`,
		title: `Test Skill ${uniqueId()}`,
		content: "# Test\n\nThis is a test skill.",
		tags: ["test"],
		...overrides,
	}),

	tag: (overrides?: { name?: string; description?: string }) => ({
		name: overrides?.name ?? `tag-${uniqueId()}`,
		description: overrides?.description,
	}),

	tags: (count: number) => Array.from({ length: count }, () => factories.tag()),
};

export function resetFactories() {
	counter = 0;
}
