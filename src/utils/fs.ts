import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";

/**
 * Get the project root directory (process working directory)
 */
export function getProjectRoot(): string {
	return process.cwd();
}

/**
 * Convert an absolute path to a path relative to the project root.
 * If the path is already relative, returns it as-is.
 */
export function toRelativePath(filePath: string): string {
	if (!isAbsolute(filePath)) {
		return filePath;
	}
	return relative(getProjectRoot(), filePath);
}

/**
 * Convert a relative path to an absolute path from the project root.
 * If the path is already absolute, returns it as-is.
 */
export function toAbsolutePath(filePath: string): string {
	if (isAbsolute(filePath)) {
		return filePath;
	}
	return resolve(getProjectRoot(), filePath);
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(toAbsolutePath(path));
		return true;
	} catch {
		return false;
	}
}

/**
 * Read a file's text content
 */
export async function readTextFile(path: string): Promise<string> {
	return readFile(toAbsolutePath(path), "utf-8");
}

/**
 * Write text content to a file
 */
export async function writeTextFile(
	path: string,
	content: string,
): Promise<void> {
	await writeFile(toAbsolutePath(path), content, "utf-8");
}
