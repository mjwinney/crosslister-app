// Shared by the settings dialog and the server; keep free of server-only imports.

export const DEFAULT_TIMEZONE = 'America/Chicago';

// Node's list omits 'UTC' on some runtimes, so it is added explicitly.
export const TIMEZONES: string[] = Array.from(
    new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])
).sort();

export function isValidTimezone(value: unknown): value is string {
    return typeof value === 'string' && TIMEZONES.includes(value);
}

// Users created before the field existed have no stored timezone.
export function resolveTimezone(value: unknown): string {
    return isValidTimezone(value) ? value : DEFAULT_TIMEZONE;
}
