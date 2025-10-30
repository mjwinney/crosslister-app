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