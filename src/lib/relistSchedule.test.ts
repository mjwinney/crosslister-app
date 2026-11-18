import { describe, expect, it } from 'vitest';
import { getRelistAt } from './relistSchedule';

describe('getRelistAt', () => {
	const start = new Date('2025-01-15T10:00:00.000Z');

	it('schedules the first relist two days before the monthly anniversary', () => {
		expect(getRelistAt(start, start)).toEqual(new Date('2025-02-13T10:00:00.000Z'));
	});

	it('finds the current cycle for an old listing', () => {
		expect(getRelistAt(start, new Date('2026-11-16T10:00:00.000Z')))
			.toEqual(new Date('2026-12-13T10:00:00.000Z'));
	});

	it('keeps the relist due before renewal', () => {
		expect(getRelistAt(start, new Date('2025-02-15T09:59:59.000Z')))
			.toEqual(new Date('2025-02-13T10:00:00.000Z'));
	});

	it('advances to the next monthly anniversary at renewal', () => {
		expect(getRelistAt(start, new Date('2025-02-15T10:00:00.000Z')))
			.toEqual(new Date('2025-03-13T10:00:00.000Z'));
	});

	it('calculates the mug listing from its original monthly anniversary', () => {
		expect(getRelistAt(new Date('2026-04-24T17:21:46.000Z'), new Date('2026-11-18T12:00:00.000Z')))
			.toEqual(new Date('2026-11-22T17:21:46.000Z'));
	});

	it('clamps short months without losing the original day of month', () => {
		const monthEnd = new Date('2025-01-31T10:00:00.000Z');
		expect(getRelistAt(monthEnd, monthEnd)).toEqual(new Date('2025-02-26T10:00:00.000Z'));
		expect(getRelistAt(monthEnd, new Date('2025-02-28T10:00:00.000Z')))
			.toEqual(new Date('2025-03-29T10:00:00.000Z'));
		expect(getRelistAt(new Date('2024-01-31T10:00:00.000Z'), new Date('2024-02-01T10:00:00.000Z')))
			.toEqual(new Date('2024-02-27T10:00:00.000Z'));
	});
});