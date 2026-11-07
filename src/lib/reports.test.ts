// src/lib/reports.test.ts
import { describe, expect, it } from 'vitest';
import { getReportRange, startOfYearInZone } from './reports';
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
