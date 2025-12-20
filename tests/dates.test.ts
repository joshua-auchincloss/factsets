import { describe, expect, it } from "bun:test";
import {
	nowISO,
	daysAgoISO,
	hoursAgoISO,
	daysSince,
	secondsSince,
	isOlderThanDays,
	isOlderThanHours,
} from "../src/utils/dates";
import dayjs from "dayjs";

describe("utils/dates", () => {
	describe("nowISO", () => {
		it("returns current time as ISO string", () => {
			const result = nowISO();
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
			// Should be within 1 second of now
			expect(dayjs(result).diff(dayjs(), "second")).toBeLessThanOrEqual(1);
		});
	});

	describe("daysAgoISO", () => {
		it("returns ISO string for N days ago", () => {
			const result = daysAgoISO(7);
			const diff = dayjs().diff(dayjs(result), "day");
			expect(diff).toBe(7);
		});

		it("returns now for 0 days", () => {
			const result = daysAgoISO(0);
			const diff = dayjs().diff(dayjs(result), "second");
			expect(diff).toBeLessThanOrEqual(1);
		});
	});

	describe("hoursAgoISO", () => {
		it("returns ISO string for N hours ago", () => {
			const result = hoursAgoISO(24);
			const diff = dayjs().diff(dayjs(result), "hour");
			expect(diff).toBe(24);
		});

		it("returns now for 0 hours", () => {
			const result = hoursAgoISO(0);
			const diff = dayjs().diff(dayjs(result), "second");
			expect(diff).toBeLessThanOrEqual(1);
		});
	});

	describe("daysSince", () => {
		it("returns days since a date", () => {
			const sevenDaysAgo = dayjs().subtract(7, "day").toISOString();
			expect(daysSince(sevenDaysAgo)).toBe(7);
		});

		it("returns 0 for today", () => {
			expect(daysSince(nowISO())).toBe(0);
		});
	});

	describe("secondsSince", () => {
		it("returns seconds since a date", () => {
			const twoMinutesAgo = dayjs().subtract(120, "second").toISOString();
			const result = secondsSince(twoMinutesAgo);
			// Allow small variance for execution time
			expect(result).toBeGreaterThanOrEqual(119);
			expect(result).toBeLessThanOrEqual(122);
		});
	});

	describe("isOlderThanDays", () => {
		it("returns true for dates older than threshold", () => {
			const tenDaysAgo = dayjs().subtract(10, "day").toISOString();
			expect(isOlderThanDays(tenDaysAgo, 7)).toBe(true);
		});

		it("returns false for dates newer than threshold", () => {
			const threeDaysAgo = dayjs().subtract(3, "day").toISOString();
			expect(isOlderThanDays(threeDaysAgo, 7)).toBe(false);
		});

		it("returns true for dates exactly at threshold", () => {
			const sevenDaysAgo = dayjs().subtract(7, "day").toISOString();
			expect(isOlderThanDays(sevenDaysAgo, 7)).toBe(true);
		});
	});

	describe("isOlderThanHours", () => {
		it("returns true for dates older than threshold", () => {
			const twoHoursAgo = dayjs().subtract(2, "hour").toISOString();
			expect(isOlderThanHours(twoHoursAgo, 1)).toBe(true);
		});

		it("returns false for dates newer than threshold", () => {
			const thirtyMinutesAgo = dayjs().subtract(30, "minute").toISOString();
			expect(isOlderThanHours(thirtyMinutesAgo, 1)).toBe(false);
		});

		it("returns true for dates exactly at threshold", () => {
			const oneHourAgo = dayjs().subtract(1, "hour").toISOString();
			expect(isOlderThanHours(oneHourAgo, 1)).toBe(true);
		});
	});
});
