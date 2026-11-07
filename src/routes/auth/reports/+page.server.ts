// src/routes/auth/reports/+page.server.ts
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEbayReportSyncedAt, getEbaySoldItemsForReport, setEbayReportSyncedAt } from '$lib/server/DatabaseUtils';
import { syncEbayOrdersForRange } from '$lib/server/ebayUtils';
import { buildReportLines, buildReportTotals, getReportRange, parseReportPeriod } from '$lib/reports';
import { resolveTimezone } from '$lib/timezones';

export const load: PageServerLoad = async ({ url, locals }) => {
    const userId = locals.session?.userId;
    if (!userId) {
        redirect(302, '/');
    }

    const timeZone = resolveTimezone(locals.user?.timezone);
    const period = parseReportPeriod(url.searchParams.get('period'));
    const range = getReportRange(period, new Date(), timeZone);

    const soldResult = await getEbaySoldItemsForReport(userId, range.from, range.to);
    if (!soldResult.ok) {
        error(500, 'Failed to load sales data');
    }

    const lines = buildReportLines(soldResult.data);
    const lastRefreshed = await getEbayReportSyncedAt(userId, period);

    return {
        period,
        timeZone,
        title: range.title,
        lines,
        totals: buildReportTotals(lines),
        lastRefreshed
    };
};

export const actions: Actions = {
    refresh: async ({ request, locals }) => {
        const userId = locals.session?.userId;
        if (!userId) {
            return fail(401, { message: 'Not signed in.' });
        }

        const formData = await request.formData();
        const period = parseReportPeriod(String(formData.get('period') ?? ''));
        const now = new Date();
        const range = getReportRange(period, now, resolveTimezone(locals.user?.timezone));

        const syncResult = await syncEbayOrdersForRange(locals, range.from, range.to);
        if (!syncResult.ok) {
            console.error(`Report refresh failed for userId:${userId} period:${period}: ${syncResult.message}`);
            return fail(syncResult.status, { message: 'Refresh failed. Check the eBay connection and try again.', period });
        }

        await setEbayReportSyncedAt(userId, period, now);
        return { success: true, period, synced: syncResult.synced };
    }
};
