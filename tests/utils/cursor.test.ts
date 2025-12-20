import { describe, it, expect } from "bun:test";
import {
	encodeCursor,
	decodeCursor,
	getNextCursor,
} from "../../src/utils/cursor";

describe("cursor utilities", () => {
	describe("encodeCursor", () => {
		it("encodes offset to base64url string", () => {
			const cursor = encodeCursor({ offset: 10 });
			expect(typeof cursor).toBe("string");
			expect(cursor.length).toBeGreaterThan(0);
		});

		it("produces different cursors for different offsets", () => {
			const cursor1 = encodeCursor({ offset: 10 });
			const cursor2 = encodeCursor({ offset: 20 });
			expect(cursor1).not.toBe(cursor2);
		});
	});

	describe("decodeCursor", () => {
		it("decodes valid cursor", () => {
			const original = { offset: 42 };
			const encoded = encodeCursor(original);
			const decoded = decodeCursor(encoded);

			expect(decoded).not.toBeNull();
			expect(decoded!.offset).toBe(42);
		});

		it("returns null for invalid base64", () => {
			const result = decodeCursor("not-valid-base64!!!");
			expect(result).toBeNull();
		});

		it("returns null for valid base64 but invalid JSON", () => {
			const invalidJson = Buffer.from("not json").toString("base64url");
			const result = decodeCursor(invalidJson);
			expect(result).toBeNull();
		});

		it("returns null for valid JSON but missing offset", () => {
			const noOffset = Buffer.from(JSON.stringify({ foo: "bar" })).toString(
				"base64url",
			);
			const result = decodeCursor(noOffset);
			expect(result).toBeNull();
		});

		it("returns null for negative offset", () => {
			const negativeOffset = Buffer.from(
				JSON.stringify({ offset: -1 }),
			).toString("base64url");
			const result = decodeCursor(negativeOffset);
			expect(result).toBeNull();
		});

		it("returns null for non-number offset", () => {
			const stringOffset = Buffer.from(
				JSON.stringify({ offset: "10" }),
			).toString("base64url");
			const result = decodeCursor(stringOffset);
			expect(result).toBeNull();
		});
	});

	describe("getNextCursor", () => {
		it("returns cursor when more results exist", () => {
			// offset=0, limit=10, fetched=10 means more might exist
			const cursor = getNextCursor(0, 10, 10);
			expect(cursor).toBeDefined();

			const decoded = decodeCursor(cursor!);
			expect(decoded!.offset).toBe(10);
		});

		it("returns undefined when fewer results than limit", () => {
			// offset=0, limit=10, fetched=5 means no more results
			const cursor = getNextCursor(0, 10, 5);
			expect(cursor).toBeUndefined();
		});

		it("returns undefined when no results fetched", () => {
			const cursor = getNextCursor(0, 10, 0);
			expect(cursor).toBeUndefined();
		});

		it("calculates correct offset for subsequent pages", () => {
			// Second page: offset=10, limit=10, fetched=10
			const cursor = getNextCursor(10, 10, 10);
			expect(cursor).toBeDefined();

			const decoded = decodeCursor(cursor!);
			expect(decoded!.offset).toBe(20);
		});
	});

	describe("roundtrip", () => {
		it("maintains data integrity through encode/decode cycle", () => {
			const offsets = [0, 1, 10, 100, 1000, 9999];

			for (const offset of offsets) {
				const encoded = encodeCursor({ offset });
				const decoded = decodeCursor(encoded);
				expect(decoded!.offset).toBe(offset);
			}
		});
	});
});
