/**
 * Frontmatter utilities for skill markdown files.
 * Handles parsing and generating YAML frontmatter for skill metadata.
 */

export interface SkillFrontmatter {
	name: string;
	title?: string;
	tags?: string[];
	updated?: string;
	description?: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/;

/**
 * Parse frontmatter from markdown content.
 * Returns null if no valid frontmatter found.
 */
export function parseFrontmatter(content: string): {
	frontmatter: SkillFrontmatter | null;
	body: string;
} {
	const match = content.match(FRONTMATTER_REGEX);
	if (!match) {
		return { frontmatter: null, body: content };
	}

	const yamlContent = match[1];
	const body = content.slice(match[0].length);

	try {
		const frontmatter = parseYaml(yamlContent ?? "");
		return { frontmatter, body };
	} catch {
		return { frontmatter: null, body: content };
	}
}

/**
 * Simple YAML parser for frontmatter.
 * Handles basic key-value pairs and arrays.
 */
function parseYaml(yaml: string): SkillFrontmatter {
	const result: SkillFrontmatter = { name: "" };
	const lines = yaml.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		// Handle array items (for tags)
		if (trimmed.startsWith("- ")) {
			continue; // Arrays handled in the key parsing below
		}

		const colonIndex = trimmed.indexOf(":");
		if (colonIndex === -1) continue;

		const key = trimmed.slice(0, colonIndex).trim();
		let value = trimmed.slice(colonIndex + 1).trim();

		// Handle inline arrays: tags: [tag1, tag2]
		if (value.startsWith("[") && value.endsWith("]")) {
			const arrayContent = value.slice(1, -1);
			const items = arrayContent
				.split(",")
				.map((s) => s.trim().replace(/^["']|["']$/g, ""))
				.filter(Boolean);

			if (key === "tags") {
				result.tags = items;
			}
			continue;
		}

		// Handle multiline arrays
		if (value === "" || value === "[]") {
			// Check for array items on following lines
			const arrayItems: string[] = [];
			const lineIndex = lines.indexOf(line);
			for (let i = lineIndex + 1; i < lines.length; i++) {
				const nextLine = lines[i]?.trim() ?? "";
				if (nextLine.startsWith("- ")) {
					arrayItems.push(
						nextLine
							.slice(2)
							.trim()
							.replace(/^["']|["']$/g, ""),
					);
				} else if (nextLine && !nextLine.startsWith("#")) {
					break;
				}
			}
			if (key === "tags" && arrayItems.length > 0) {
				result.tags = arrayItems;
			}
			continue;
		}

		// Remove quotes from string values
		value = value.replace(/^["']|["']$/g, "");

		switch (key) {
			case "name":
				result.name = value;
				break;
			case "title":
				result.title = value;
				break;
			case "description":
				result.description = value;
				break;
			case "updated":
				result.updated = value;
				break;
		}
	}

	return result;
}

/**
 * Generate frontmatter string from metadata.
 */
export function generateFrontmatter(metadata: SkillFrontmatter): string {
	const lines: string[] = ["---"];

	lines.push(`name: ${metadata.name}`);

	if (metadata.title) {
		lines.push(`title: "${escapeYamlString(metadata.title)}"`);
	}

	if (metadata.description) {
		lines.push(`description: "${escapeYamlString(metadata.description)}"`);
	}

	if (metadata.tags && metadata.tags.length > 0) {
		lines.push(`tags: [${metadata.tags.map((t) => `"${t}"`).join(", ")}]`);
	}

	if (metadata.updated) {
		lines.push(`updated: ${metadata.updated}`);
	}

	lines.push("---");
	return lines.join("\n");
}

/**
 * Escape special characters for YAML strings.
 */
function escapeYamlString(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Add or update frontmatter in markdown content.
 */
export function updateFrontmatter(
	content: string,
	metadata: SkillFrontmatter,
): string {
	const { body } = parseFrontmatter(content);
	const newFrontmatter = generateFrontmatter(metadata);
	return `${newFrontmatter}\n${body}`;
}

/**
 * Extract body content without frontmatter.
 */
export function extractBody(content: string): string {
	const { body } = parseFrontmatter(content);
	return body;
}

/**
 * Check if content has frontmatter.
 */
export function hasFrontmatter(content: string): boolean {
	return FRONTMATTER_REGEX.test(content);
}
