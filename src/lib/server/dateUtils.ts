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
  // Returns the current time as UTC (this is typically used for database operations)
  return new Date();
}

export function getStartOfWeekUTC(offset: number = 0): Date {
  const now = new Date();
  
  // Use local time to determine the day of week (not UTC)
  // This ensures week boundaries align with user's local timezone
  const day = now.getDay(); // Sunday = 0, Monday = 1 in local time
  const diffToMonday = (day + 6) % 7;
  
  // Calculate Monday's date in local time
  const monday = new Date(now);
  monday.setDate(monday.getDate() - diffToMonday - (offset * 7));
  monday.setHours(0, 0, 1, 0); // Set to 12:00:01 AM local time

  return monday;
}

export function getEndOfWeekUTC(offset: number = 0): Date {
  const now = new Date();
  
  // Use local time to determine the day of week (not UTC)
  // This ensures week boundaries align with user's local timezone
  const day = now.getDay();
  const diffToSunday = (7 - day) % 7;
  
  // Calculate Sunday's date in local time
  const sunday = new Date(now);
  sunday.setDate(sunday.getDate() + diffToSunday - (offset * 7));
  sunday.setHours(0, 0, 0, 0); // Set to midnight local time (start of Monday)

  return sunday;
}

export function getStartOfMonthUTC(offset: number = 0): Date {
  const now = new Date();
  
  // Calculate the month offset in local time
  const year = now.getFullYear();
  const month = now.getMonth() - offset;

  const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0); // Midnight local time
  return startOfMonth;
}

export function getEndOfMonthUTC(offset: number = 0): Date {
  const now = new Date();
  
  // Calculate the month offset in local time
  const year = now.getFullYear();
  const month = now.getMonth() - offset + 1;

  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999); // Last moment of month in local time
  return endOfMonth;
}