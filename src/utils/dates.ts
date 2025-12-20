import dayjs from "dayjs";

/**
 * Get current timestamp as ISO string
 */
export function nowISO(): string {
	return dayjs().toISOString();
}

/**
 * Get ISO string for N days ago
 */
export function daysAgoISO(days: number): string {
	return dayjs().subtract(days, "day").toISOString();
}

/**
 * Get ISO string for N hours ago
 */
export function hoursAgoISO(hours: number): string {
	return dayjs().subtract(hours, "hour").toISOString();
}

/**
 * Calculate days since a given ISO date string
 */
export function daysSince(isoDate: string): number {
	return dayjs().diff(dayjs(isoDate), "day");
}

/**
 * Calculate hours since a given ISO date string
 */
export function hoursSince(isoDate: string): number {
	return dayjs().diff(dayjs(isoDate), "hour");
}

/**
 * Calculate seconds since a given ISO date string
 */
export function secondsSince(isoDate: string): number {
	return dayjs().diff(dayjs(isoDate), "second");
}

/**
 * Check if an ISO date is older than N days
 */
export function isOlderThanDays(isoDate: string, days: number): boolean {
	return daysSince(isoDate) >= days;
}

/**
 * Check if an ISO date is older than N hours
 */
export function isOlderThanHours(isoDate: string, hours: number): boolean {
	return dayjs().diff(dayjs(isoDate), "hour") >= hours;
}
