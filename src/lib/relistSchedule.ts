const DAY_MS = 24 * 60 * 60 * 1000;

export function getRelistAt(startTime: Date, now = new Date()): Date {
	const elapsedMonths = (now.getUTCFullYear() - startTime.getUTCFullYear()) * 12
		+ now.getUTCMonth() - startTime.getUTCMonth();
	let months = Math.max(1, elapsedMonths);

	function anniversary(monthOffset: number): Date {
		const date = new Date(startTime);
		date.setUTCDate(1);
		date.setUTCMonth(startTime.getUTCMonth() + monthOffset);
		const endOfMonth = new Date(date);
		endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);
		date.setUTCDate(Math.min(startTime.getUTCDate(), endOfMonth.getUTCDate()));
		return date;
	}

	let renewal = anniversary(months);
	if (renewal.getTime() <= now.getTime()) {
		months += 1;
		renewal = anniversary(months);
	}
	return new Date(renewal.getTime() - 2 * DAY_MS);
}