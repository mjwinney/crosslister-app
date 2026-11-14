import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPoshmarkSoldItemsForReport } from '$lib/server/DatabaseUtils';
import { renderReportPdf } from '$lib/server/reportPdf';
import { buildReportTotals, getReportRange, parseReportPeriod } from '$lib/reports';
import { resolveTimezone } from '$lib/timezones';

export const GET: RequestHandler = async ({ url, locals }) => {
    const userId = locals.session?.userId;
    if (!userId) {
        error(401, 'Not signed in');
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
    const pdf = await renderReportPdf(range.title, lines, buildReportTotals(lines), timeZone, 'Poshmark');
    const fileName = `poshmark-sales-${period}-${range.from.getUTCFullYear()}.pdf`;

    return new Response(new Uint8Array(pdf), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`
        }
    });
};