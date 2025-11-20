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

export function getStartOfWeek(weekOffset: number = 0): Date {
  const now = new Date();
  const day = now.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday - (weekOffset * 7));
  monday.setHours(0, 0, 1, 0); // 12:00:01 AM

  return monday;
}

export function getEndOfWeek(weekOffset: number = 0): Date {
  const now = new Date();
  const day = now.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
  const diffToSunday = (7 - day) % 7;

  const sunday = new Date(now);
  sunday.setDate(now.getDate() + diffToSunday - (weekOffset * 7));
  sunday.setHours(24, 0, 0, 0); // Midnight at end of Sunday (start of Monday)

  return sunday;
}

export function getStartOfMonth(offset: number = 0): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - offset;

  const start = new Date(year, month, 1);
  start.setHours(0, 0, 0, 0); // Midnight

  return start;
}

export function getEndOfMonth(offset: number = 0): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - offset + 1;

  const end = new Date(year, month, 0); // Day 0 of next month = last day of current month
  end.setHours(23, 59, 59, 999); // End of day

  return end;
}