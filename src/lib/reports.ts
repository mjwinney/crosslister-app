// Shared by reporting pages, dashboard stats, and PDF routes; keep free of server-only imports.

export type ReportPeriod = 'ytd' | 'lastYear';
export type ReportSortOrder = 'oldest' | 'latest';

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
    { value: 'ytd', label: 'Year to Date' },
    { value: 'lastYear', label: 'Last Year' }
];

export type ReportRow = {
    itemId: string;
    title: string;
    soldTime: Date;
    soldPrice: number;
    purchasePrice?: number;
    feePrice: number;
    addFeeGeneral: number;
    finalShippingCost: number;
};

export type ReportLine = {
    itemId: string;
    title: string;
    soldTime: Date;
    sales: number;
    cogs: number | null;
    fees: number;
    shipping: number;
    missingCogs: boolean;
};

export type ReportTotals = {
    count: number;
    sales: number;
    cogs: number;
    fees: number;
    shipping: number;
    missingCogsCount: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100 || 0;

export type DashboardDateRanges = {
    currentWeek: { from: Date; to: Date };
    previousWeek: { from: Date; to: Date };
    previousMonth: { from: Date; to: Date };
    last6Months: { from: Date; to: Date };
};

export function parseReportPeriod(value: string | null | undefined): ReportPeriod {
    return value === 'lastYear' ? 'lastYear' : 'ytd';
}

// Offset in ms of timeZone from UTC at the given instant (positive east of UTC).
function zoneOffsetMs(instant: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).formatToParts(instant);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function startOfDateInZone(year: number, month: number, day: number, timeZone: string): Date {
    const naive = Date.UTC(year, month - 1, day);
    const first = naive - zoneOffsetMs(new Date(naive), timeZone);
    return new Date(naive - zoneOffsetMs(new Date(first), timeZone));
}

// UTC instant of local midnight on January 1 in timeZone; two passes handle DST at the boundary.
export function startOfYearInZone(year: number, timeZone: string): Date {
    return startOfDateInZone(year, 1, 1, timeZone);
}

export function getDashboardDateRanges(now: Date, timeZone: string): DashboardDateRanges {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(now);
    const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');

    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const mondayOffset = (weekday + 6) % 7;
    const currentMonday = new Date(Date.UTC(year, month - 1, day - mondayOffset));
    const previousMonday = new Date(currentMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentWeekStart = startOfDateInZone(
        currentMonday.getUTCFullYear(),
        currentMonday.getUTCMonth() + 1,
        currentMonday.getUTCDate(),
        timeZone
    );
    const previousWeekStart = startOfDateInZone(
        previousMonday.getUTCFullYear(),
        previousMonday.getUTCMonth() + 1,
        previousMonday.getUTCDate(),
        timeZone
    );
    const currentMonthStart = startOfDateInZone(year, month, 1, timeZone);
    const previousMonthStart = startOfDateInZone(year, month - 1, 1, timeZone);
    const sixMonthsAgoStart = startOfDateInZone(year, month - 6, 1, timeZone);

    return {
        currentWeek: { from: currentWeekStart, to: now },
        previousWeek: { from: previousWeekStart, to: new Date(currentWeekStart.getTime() - 1) },
        previousMonth: { from: previousMonthStart, to: new Date(currentMonthStart.getTime() - 1) },
        last6Months: { from: sixMonthsAgoStart, to: new Date(currentMonthStart.getTime() - 1) }
    };
}

export function getReportRange(
    period: ReportPeriod,
    now: Date,
    timeZone: string
): { from: Date; to: Date; title: string } {
    const year = Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(now));
    const startOfYear = (y: number) => startOfYearInZone(y, timeZone);

    if (period === 'lastYear') {
        return {
            from: startOfYear(year - 1),
            to: new Date(startOfYear(year).getTime() - 1),
            title: `${year - 1} Full Year`
        };
    }

    return { from: startOfYear(year), to: now, title: `${year} Year to Date` };
}

// Shipping is the seller's label cost less what the buyer paid, so it is the negative of finalShippingCost.
export function buildReportLines(rows: ReportRow[]): ReportLine[] {
    return rows.map((row) => ({
        itemId: row.itemId,
        title: row.title,
        soldTime: row.soldTime,
        sales: round2(row.soldPrice),
        cogs: row.purchasePrice ?? null,
        fees: round2(row.feePrice + row.addFeeGeneral),
        shipping: round2(-row.finalShippingCost),
        missingCogs: !row.purchasePrice
    }));
}

export function sortReportLines(lines: readonly ReportLine[], order: ReportSortOrder): ReportLine[] {
    const direction = order === 'oldest' ? 1 : -1;
    return [...lines].sort((a, b) => direction * (a.soldTime.getTime() - b.soldTime.getTime()));
}

export function buildReportTotals(lines: ReportLine[]): ReportTotals {
    return lines.reduce<ReportTotals>(
        (totals, line) => ({
            count: totals.count + 1,
            sales: round2(totals.sales + line.sales),
            cogs: round2(totals.cogs + (line.cogs ?? 0)),
            fees: round2(totals.fees + line.fees),
            shipping: round2(totals.shipping + line.shipping),
            missingCogsCount: totals.missingCogsCount + (line.missingCogs ? 1 : 0)
        }),
        { count: 0, sales: 0, cogs: 0, fees: 0, shipping: 0, missingCogsCount: 0 }
    );
}

export function formatMoney(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatSaleDate(date: Date, timeZone: string): string {
    return date.toLocaleDateString('en-US', { timeZone });
}
