const DAY_MS = 24 * 60 * 60 * 1000;
const RENEWAL_INTERVAL_MS = 30 * DAY_MS;

export function getRelistAt(startTime: Date, now = new Date()): Date {
	const elapsed = now.getTime() - startTime.getTime();
	const cycle = Math.max(0, Math.floor(elapsed / RENEWAL_INTERVAL_MS));
	return new Date(startTime.getTime() + cycle * RENEWAL_INTERVAL_MS + 29 * DAY_MS);
}