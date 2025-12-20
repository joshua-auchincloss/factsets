/**
 * MCP-compliant cursor-based pagination utilities.
 *
 * Cursors are opaque tokens that encode pagination state.
 * Clients should not parse or modify cursors.
 */

export interface CursorData {
	offset: number;
}

/**
 * Encode pagination state into an opaque cursor string
 */
export function encodeCursor(data: CursorData): string {
	return Buffer.from(JSON.stringify(data)).toString("base64url");
}

/**
 * Decode a cursor string back to pagination state.
 * Returns null if cursor is invalid.
 */
export function decodeCursor(cursor: string): CursorData | null {
	try {
		const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
		const data = JSON.parse(decoded);
		if (typeof data.offset === "number" && data.offset >= 0) {
			return data as CursorData;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Calculate the next cursor if more results exist.
 * Returns undefined if there are no more results.
 */
export function getNextCursor(
	currentOffset: number,
	limit: number,
	totalFetched: number,
): string | undefined {
	// If we fetched fewer than limit, we've reached the end
	if (totalFetched < limit) {
		return undefined;
	}
	// Return cursor for next page
	return encodeCursor({ offset: currentOffset + limit });
}
