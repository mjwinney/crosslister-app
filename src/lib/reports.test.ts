// src/lib/reports.test.ts
import { describe, expect, it } from 'vitest';
import { getReportRange, sortReportLines, startOfYearInZone, type ReportLine } from './reports';
import { isValidTimezone, resolveTimezone } from './timezones';

describe('startOfYearInZone', () => {
    it('returns local midnight Jan 1 for Chicago (UTC-6 in winter)', () => {
        expect(startOfYearInZone(2025, 'America/Chicago').toISOString()).toBe('2025-01-01T06:00:00.000Z');
    });

    it('returns midnight UTC for UTC', () => {
        expect(startOfYearInZone(2025, 'UTC').toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('returns local midnight for a zone ahead of UTC', () => {
        expect(startOfYearInZone(2025, 'Asia/Tokyo').toISOString()).toBe('2024-12-31T15:00:00.000Z');
    });
});

describe('getReportRange', () => {
    const now = new Date('2025-06-15T12:00:00.000Z');

    it('uses the supplied timezone for year to date', () => {
        const range = getReportRange('ytd', now, 'UTC');
        expect(range.from.toISOString()).toBe('2025-01-01T00:00:00.000Z');
        expect(range.title).toBe('2025 Year to Date');
    });

    it('computes last year bounds in the supplied timezone', () => {
        const range = getReportRange('lastYear', now, 'America/Chicago');
        expect(range.from.toISOString()).toBe('2024-01-01T06:00:00.000Z');
        expect(range.to.toISOString()).toBe('2025-01-01T05:59:59.999Z');
    });
});

describe('sortReportLines', () => {
    const line = (itemId: string, soldTime: string): ReportLine => ({
        itemId,
        title: itemId,
        soldTime: new Date(soldTime),
        sales: 0,
        cogs: null,
        fees: 0,
        shipping: 0,
        missingCogs: true
    });

    it('sorts by sale instant in both directions without changing the source or tie order', () => {
        const lines = [
            line('middle-a', '2025-03-01T10:00:00Z'),
            line('latest', '2025-03-01T12:00:00Z'),
            line('oldest', '2024-12-31T23:00:00Z'),
            line('middle-b', '2025-03-01T10:00:00Z')
        ];
        const original = [...lines];

        expect(sortReportLines(lines, 'oldest').map((item) => item.itemId))
            .toEqual(['oldest', 'middle-a', 'middle-b', 'latest']);
        expect(sortReportLines(lines, 'latest').map((item) => item.itemId))
            .toEqual(['latest', 'middle-a', 'middle-b', 'oldest']);
        expect(lines).toEqual(original);
    });

    it('handles empty reports', () => {
        expect(sortReportLines([], 'oldest')).toEqual([]);
        expect(sortReportLines([], 'latest')).toEqual([]);
    });
});

describe('timezone validation', () => {
    it('accepts IANA names and UTC', () => {
        expect(isValidTimezone('America/Chicago')).toBe(true);
        expect(isValidTimezone('UTC')).toBe(true);
    });

    it('rejects unknown values', () => {
        expect(isValidTimezone('Mars/Olympus')).toBe(false);
        expect(isValidTimezone(undefined)).toBe(false);
    });

    it('falls back to the default when unset or invalid', () => {
        expect(resolveTimezone(undefined)).toBe('America/Chicago');
        expect(resolveTimezone('Mars/Olympus')).toBe('America/Chicago');
        expect(resolveTimezone('Europe/London')).toBe('Europe/London');
    });
});
