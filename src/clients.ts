export type ClientType = "github-copilot" | "cursor" | "claude" | "generic";

const CLIENT_SKILLS_PATHS: Record<ClientType, string> = {
	"github-copilot": ".github/prompts/skills",
	cursor: ".cursor/prompts/skills",
	claude: ".claude/skills",
	generic: ".factsets/skills",
};

export function getSkillsDir(client: string): string {
	return (
		CLIENT_SKILLS_PATHS[client as ClientType] ?? CLIENT_SKILLS_PATHS["generic"]
	);
}

export function isValidClient(client: string): client is ClientType {
	return client in CLIENT_SKILLS_PATHS;
}

export const DEFAULT_CLIENT: ClientType = "github-copilot";
