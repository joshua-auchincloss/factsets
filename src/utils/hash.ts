import { createHash } from "node:crypto";

/**
 * Compute a hash of content using Node's crypto module
 */
export function computeHash(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}
