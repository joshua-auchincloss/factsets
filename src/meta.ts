import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json" with { type: "json" };

const _this_file = fileURLToPath(import.meta.url);

const rootDir = dirname(_this_file);

const findPath = (relativeToRoot: string) => {
	return join(rootDir, relativeToRoot);
};

export const projectMeta = {
	rootDir,
	findPath,
	version: packageJson["version"],
};
