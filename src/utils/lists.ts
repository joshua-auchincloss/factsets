export const any = <T>(
	cmp: (arr: T[], value: T) => boolean,
	arr: T[] | null | undefined,
	...values: T[]
): boolean => {
	if (!arr || arr.length === 0) {
		return false;
	}
	for (const val of values) {
		if (cmp(arr, val)) {
			return true;
		}
	}
	return false;
};

export const anyIncludes = <T>(
	arr: T[] | null | undefined,
	...values: T[]
): boolean => {
	return any((a, v) => a.includes(v), arr, ...values);
};
