import { describe, expect, it } from 'vitest';
import { getRelistAt } from './relistSchedule';

describe('getRelistAt', () => {
	const start = new Date('2025-01-15T10:00:00.000Z');

	it('schedules the first relist 29 days after the start', () => {
		expect(getRelistAt(start, start)).toEqual(new Date('2025-02-13T10:00:00.000Z'));
	});

	it('finds the current cycle for an old listing', () => {
		expect(getRelistAt(start, new Date('2026-11-16T10:00:00.000Z')))
			.toEqual(new Date('2026-12-05T10:00:00.000Z'));
	});

	it('keeps the relist due during the day before renewal', () => {
		expect(getRelistAt(start, new Date('2025-02-14T09:59:59.000Z')))
			.toEqual(new Date('2025-02-13T10:00:00.000Z'));
	});

	it('advances 30 days at renewal', () => {
		expect(getRelistAt(start, new Date('2025-02-14T10:00:00.000Z')))
			.toEqual(new Date('2025-03-15T10:00:00.000Z'));
	});
});