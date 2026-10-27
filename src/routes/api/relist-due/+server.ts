import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
    getEbayTokensFromDB,
    getDueRelistGroupsByUser,
    updateEbayMetadata
} from '$lib/server/DatabaseUtils';
import { refreshEbayToken, relistEbayItemsWithPriceChange } from '$lib/server/ebayUtils';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 60 };

const USER_BATCH_LIMIT = 10;
const ITEMS_PER_USER_LIMIT = 50;
const DEFAULT_INTERVAL_DAYS = 30;
const TIME_BUDGET_MS = 45_000;

// Invoked by Vercel Cron, which sends `Authorization: Bearer ${CRON_SECRET}`
export const GET: RequestHandler = async ({ request }) => {
    console.log(`relist-due: RequestHandler ENTER`);
    if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
        console.warn(`relist-due: unauthorized request`);
        return json({ message: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const deadline = Date.now() + TIME_BUDGET_MS;
    console.log(`relist-due: authorized, now=${now.toISOString()} budget=${TIME_BUDGET_MS}ms userBatch=${USER_BATCH_LIMIT} itemsPerUser=${ITEMS_PER_USER_LIMIT}`);
    // Users handled this run are excluded so failed items are retried next run, not looped on.
    const handledUserIds: string[] = [];
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    let batchNumber = 0;
    while (Date.now() < deadline) {
        batchNumber++;
        console.log(`relist-due: fetching batch ${batchNumber}, excluding ${handledUserIds.length} handled user(s), ${deadline - Date.now()}ms left`);
        const batch = await getDueRelistGroupsByUser(now, USER_BATCH_LIMIT, ITEMS_PER_USER_LIMIT, handledUserIds);
        if (!batch.ok) {
            console.error(`relist-due: database unavailable, code=${batch.code}`);
            return json({ message: 'Database unavailable' }, { status: 500 });
        }

        if (batch.data.length === 0){
            console.log(`relist-due: no more due items to process`);
            break;
        }

        console.log(`relist-due: batch ${batchNumber} has ${batch.data.length} user(s), ${batch.data.reduce((n, g) => n + g.items.length, 0)} item(s)`);

        for (const { userId, items } of batch.data) {
            handledUserIds.push(userId);
            console.log(`relist-due: user ${userId} has ${items.length} item(s) due`);

            const locals = await buildLocals(userId).catch((error) => {
                console.error(`relist-due: buildLocals failed for user ${userId}`, error);
                return null;
            });

            for (const { itemId, metadata } of items) {
                if (Date.now() >= deadline) {
                    console.warn(`relist-due: time budget exhausted, skipping remaining items for user ${userId}`);
                    break;
                }

                console.log(`relist-due: relisting item ${itemId} for user ${userId} (relistAt=${metadata.relistAt?.toString()}, attempts=${metadata.relistAttemptCount ?? 0})`);
                let result = 'unknown error';
                let ok = false;

                if (!locals) {
                    result = 'missing or unrefreshable eBay tokens';
                } else {
                    try {
                        const response = await relistEbayItemsWithPriceChange(locals, itemId, 0);
                        ok = response.status === 200;
                        result = ok ? 'success' : `failed: ${'message' in response ? response.message : response.status}`;
                    } catch (error) {
                        result = `error: ${error instanceof Error ? error.message : String(error)}`;
                    }
                }

                const attemptTime = new Date();
                const intervalDays = metadata.relistIntervalDays ?? DEFAULT_INTERVAL_DAYS;
                console.log(`relist-due: item ${itemId} user ${userId} ok=${ok} result=${result}; updating metadata`);

                const updateStatus = await updateEbayMetadata(userId, itemId, {
                    lastRelistAttemptAt: attemptTime,
                    lastRelistResult: result,
                    relistAttemptCount: ok ? 0 : (metadata.relistAttemptCount ?? 0) + 1,
                    ...(ok
                        ? {
                              currentListedAt: attemptTime,
                              relistAt: new Date(attemptTime.getTime() + intervalDays * 24 * 60 * 60 * 1000)
                          }
                        : {})
                });
                console.log(`relist-due: item ${itemId} metadata update status=${updateStatus}`);

                processed++;
                if (ok) succeeded++;
                else {
                    failed++;
                    console.error(`relist-due: item ${itemId} user ${userId} ${result}`);
                }
            }

            console.log(`relist-due: finished user ${userId}, running totals processed=${processed} succeeded=${succeeded} failed=${failed}`);
            if (Date.now() >= deadline) break;
        }
    }

    console.log(`relist-due: loop exited after ${batchNumber} batch(es), ${handledUserIds.length} user(s) handled`);
    console.log(`relist-due: processed=${processed} succeeded=${succeeded} failed=${failed}`);
    return json({ processed, succeeded, failed });
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
