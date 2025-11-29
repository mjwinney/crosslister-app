export function convertToISO(dateStr: string): string {
  // Parse MM/DD/YY
  const [month, day, year] = dateStr.split('/').map(Number);

  // Normalize year (assumes 2000+ for 2-digit years)
  const fullYear = year < 100 ? 2000 + year : year;

  // Create a Date object with a specific time (e.g., 23:33:35.034)
  const date = new Date(Date.UTC(fullYear, month - 1, day, 23, 33, 35, 34));

  // Return ISO string
  return date.toISOString(); // "2025-10-29T23:33:35.034Z"
}

export function getNowUTCDate(): Date {
  // Get current local date/time
  const now = new Date();

  // Create a new Date object using UTC components
  const utcDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    )
  );

  return utcDate;
}

export function getStartOfWeekUTC(offset: number = 0): Date {
  const now = new Date();
  const day = now.getUTCDay(); // Sunday = 0, Monday = 1
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - diffToMonday - (offset * 7),
    0, 0, 1, 0 // 12:00:01 AM UTC
  ));

  return monday;
}

export function getEndOfWeekUTC(offset: number = 0): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToSunday = (7 - day) % 7;

  const sunday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + diffToSunday - (offset * 7),
    0, 0, 0, 0 // Midnight UTC (start of Monday)
  ));

  return sunday;
}

export function getStartOfMonthUTC(offset: number = 0): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - offset;

  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)); // Midnight UTC
}

export function getEndOfMonthUTC(offset: number = 0): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - offset + 1;

  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Last day of month
}