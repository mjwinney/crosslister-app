import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
    getEbayTokensFromDB,
    getItemsDueForRelist,
    updateEbayMetadata
} from '$lib/server/DatabaseUtils';
import { refreshEbayToken, relistEbayItemsWithPriceChange } from '$lib/server/ebayUtils';
import type { RequestHandler } from './$types';

const BATCH_LIMIT = 50;
const DEFAULT_INTERVAL_DAYS = 30;

// Invoked by Vercel Cron, which sends `Authorization: Bearer ${CRON_SECRET}`
export const GET: RequestHandler = async ({ request }) => {
    console.log(`relist-due: RequestHandler ENTER`);
    if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
        return json({ message: 'Unauthorized' }, { status: 401 });
    }

    // console.log(`relist-due: authorized, querying items due at ${new Date().toISOString()}`);

    const now = new Date();
    const due = await getItemsDueForRelist(now, BATCH_LIMIT);
    if (!due.ok) {
        // console.error(`relist-due: database unavailable, code=${due.code}`);
        return json({ message: 'Database unavailable' }, { status: 500 });
    }

    console.log(`relist-due: ${due.data.length} item(s) due for relist`);

    // const localsByUser = new Map<string, App.Locals | null>();
    // let succeeded = 0;
    // let failed = 0;

    // for (const { itemId, userId, metadata } of due.data) {
    //     let result = 'unknown error';
    //     let ok = false;

    //     try {
    //         if (!localsByUser.has(userId)) {
    //             localsByUser.set(userId, await buildLocals(userId));
    //         }
    //         const locals = localsByUser.get(userId);

    //         if (!locals) {
    //             result = 'missing or unrefreshable eBay tokens';
    //         } else {
    //             const response = await relistEbayItemsWithPriceChange(locals, itemId, 0);
    //             ok = response.status === 200;
    //             result = ok ? 'success' : `failed: ${'message' in response ? response.message : response.status}`;
    //         }
    //     } catch (error) {
    //         result = `error: ${error instanceof Error ? error.message : String(error)}`;
    //     }

    //     const attemptTime = new Date();
    //     const intervalDays = metadata.relistIntervalDays ?? DEFAULT_INTERVAL_DAYS;

    //     await updateEbayMetadata(userId, itemId, {
    //         lastRelistAttemptAt: attemptTime,
    //         lastRelistResult: result,
    //         relistAttemptCount: ok ? 0 : (metadata.relistAttemptCount ?? 0) + 1,
    //         ...(ok
    //             ? {
    //                   currentListedAt: attemptTime,
    //                   relistAt: new Date(attemptTime.getTime() + intervalDays * 24 * 60 * 60 * 1000)
    //               }
    //             : {})
    //     });

    //     if (ok) succeeded++;
    //     else {
    //         failed++;
    //         console.error(`relist-due: item ${itemId} user ${userId} ${result}`);
    //     }
    // }

    return json({ processed: due.data.length, succeeded: 0, failed: 0 });
    // return json({ processed: due.data.length, succeeded, failed });
};

async function buildLocals(userId: string): Promise<App.Locals | null> {
    console.log(`relist-due: buildLocals for user ${userId}`);
    const tokens = await getEbayTokensFromDB(userId);
    if (tokens.status !== 'success') {
        console.error(`relist-due: no eBay tokens for user ${userId}: ${tokens.message}`);
        return null;
    }
    console.log(`relist-due: user ${userId} refreshTokenStatus=${tokens.data.refreshTokenStatus}`);

    const locals = {
        session: { userId },
        ebayAccessToken: tokens.data.accessToken,
        ebayRefreshToken: tokens.data.refreshToken,
        ebaySellerUsername: tokens.data.sellerUsername
    } as unknown as App.Locals;

    if (tokens.data.refreshTokenStatus === 'expired') {
        const refreshed = await refreshEbayToken(locals).catch(() => false);
        console.log(`relist-due: token refresh for user ${userId} succeeded=${refreshed}`);
        if (!refreshed) return null;
    }

    return locals;
}
