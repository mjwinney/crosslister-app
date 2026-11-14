import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPoshmarkDaysInPastToScrape, getPoshmarkSoldItemsForReport } from '$lib/server/DatabaseUtils';
import { buildReportTotals, getReportRange, parseReportPeriod } from '$lib/reports';
import { resolveTimezone } from '$lib/timezones';

export const load: PageServerLoad = async ({ url, locals }) => {
    const userId = locals.session?.userId;
    if (!userId) {
        redirect(302, '/');
    }

    const timeZone = resolveTimezone(locals.user?.timezone);
    const period = parseReportPeriod(url.searchParams.get('period'));
    const range = getReportRange(period, new Date(), timeZone);

    const soldResult = await getPoshmarkSoldItemsForReport(userId, range.from, range.to);
    if (!soldResult.ok) {
        error(500, 'Failed to load sales data');
    }

    const lines = soldResult.data.map((item) => ({
        itemId: item.itemId,
        title: item.title,
        soldTime: item.soldTime,
        sales: item.soldPrice,
        cogs: item.purchasePrice ?? null,
        fees: item.feePrice,
        shipping: 0,
        missingCogs: !item.purchasePrice
    }));
    const daysResult = await getPoshmarkDaysInPastToScrape(userId);

    return {
        period,
        timeZone,
        title: range.title,
        lines,
        totals: buildReportTotals(lines),
        daysToGoBack: daysResult.ok ? daysResult.days ?? 90 : 90
    };
};