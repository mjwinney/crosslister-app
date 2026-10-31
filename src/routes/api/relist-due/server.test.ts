import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTestMongo, startTestMongo, stopTestMongo } from '../../../test/mongo';

const relistMock = vi.fn();

vi.mock('$lib/server/ebayUtils', () => ({
	refreshEbayToken: vi.fn(async () => true),
	relistEbayItemsWithPriceChange: (...args: unknown[]) => relistMock(...args)
}));

// Real database helpers, but no eBay token lookup.
vi.mock('$lib/server/DatabaseUtils', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/DatabaseUtils')>()),
	getEbayTokensFromDB: vi.fn(async () => ({
		status: 'success',
		data: { accessToken: 'token', refreshToken: 'refresh', refreshTokenStatus: 'valid', sellerUsername: 'seller' }
	}))
}));

await startTestMongo();
const db = await import('$lib/server/DatabaseUtils');
const { EbayItemMetadata } = await import('$lib/server/models/ebay-item-metadata');
const { GET } = await import('./+server');

const USER = 'user-1';
const DAY_MS = 24 * 60 * 60 * 1000;
const due = new Date('2026-01-01T00:00:00.000Z');

afterEach(clearTestMongo);
afterAll(stopTestMongo);

beforeEach(() => {
	relistMock.mockReset();
	// Mirrors the real helper, which moves the metadata row to the new item id.
	relistMock.mockImplementation(async (_locals, itemId: string) => {
		await db.replaceEbayItemId(USER, itemId, `${itemId}-relisted`);
		return {
			status: 200,
			data: { newItemId: `${itemId}-relisted`, oldListingEnded: true, idSwapped: true, newPrice: 95, basePrice: 100 }
		};
	});
});

function callCron(authorization?: string) {
	const request = new Request('http://localhost/api/relist-due', {
		headers: authorization ? { authorization } : {}
	});
	return (GET as any)({ request }) as Promise<Response>;
}

const authorized = 'Bearer test-cron-secret';

async function seed(itemId: string, fields: Record<string, unknown> = {}) {
	await db.updateEbayMetadata(USER, itemId, { relistEnabled: true, relistAt: due, ...fields }, true);
}

async function load(itemId: string) {
	return EbayItemMetadata.findOne({ itemId }).lean().exec();
}

describe('relist-due authorization', () => {
	it('returns 401 without an authorization header', async () => {
		expect((await callCron()).status).toBe(401);
		expect(relistMock).not.toHaveBeenCalled();
	});

	it('returns 401 with the wrong secret', async () => {
		expect((await callCron('Bearer wrong')).status).toBe(401);
		expect(relistMock).not.toHaveBeenCalled();
	});
});

describe('relist-due without a discount', () => {
	it('relists at an unchanged price and leaves the discount fields alone', async () => {
		await seed('item-1', { relistDiscountEnabled: false, relistDiscountPercent: 12, relistDiscountMaxPercent: 30 });

		const body = await (await callCron(authorized)).json();

		expect(body).toEqual({ processed: 1, succeeded: 1, failed: 0 });
		expect(relistMock).toHaveBeenCalledWith(expect.anything(), 'item-1', 0, undefined);
		expect(await load('item-1-relisted')).toMatchObject({
			relistDiscountEnabled: false,
			relistDiscountPercent: 12,
			relistDiscountMaxPercent: 30,
			relistDiscountBasePrice: null,
			relistDiscountLastPrice: null
		});
	});
});

describe('relist-due with a discount', () => {
	it('passes the discount settings and saves the base and last prices on success', async () => {
		const before = Date.now();
		await seed('item-1', { relistDiscountEnabled: true, relistDiscountPercent: 5, relistDiscountMaxPercent: 20 });

		const body = await (await callCron(authorized)).json();

		expect(body).toEqual({ processed: 1, succeeded: 1, failed: 0 });
		expect(relistMock).toHaveBeenCalledWith(expect.anything(), 'item-1', 5, {
			maxPercent: 20,
			basePrice: null,
			lastPrice: null
		});

		const saved = await load('item-1-relisted');
		expect(saved).toMatchObject({
			lastRelistResult: 'success',
			relistAttemptCount: 0,
			relistDiscountBasePrice: 100,
			relistDiscountLastPrice: 95
		});
		const nextRelist = saved!.relistAt!.getTime();
		expect(nextRelist).toBeGreaterThanOrEqual(before + 30 * DAY_MS);
		expect(nextRelist).toBeLessThanOrEqual(Date.now() + 30 * DAY_MS);
	});

	it('passes the stored base and last prices on later relists', async () => {
		await seed('item-1', {
			relistDiscountEnabled: true,
			relistDiscountPercent: 5,
			relistDiscountMaxPercent: 20,
			relistDiscountBasePrice: 100,
			relistDiscountLastPrice: 95
		});

		await callCron(authorized);

		expect(relistMock).toHaveBeenCalledWith(expect.anything(), 'item-1', 5, {
			maxPercent: 20,
			basePrice: 100,
			lastPrice: 95
		});
	});

	it('skips the relist when the stored discount settings are invalid', async () => {
		await seed('item-1', { relistDiscountEnabled: true, relistDiscountPercent: 30, relistDiscountMaxPercent: 20 });

		const body = await (await callCron(authorized)).json();

		expect(body).toEqual({ processed: 1, succeeded: 0, failed: 1 });
		expect(relistMock).not.toHaveBeenCalled();
		const saved = await load('item-1');
		expect(saved).toMatchObject({
			lastRelistResult: 'invalid relist discount settings',
			relistAttemptCount: 1,
			relistDiscountBasePrice: null,
			relistDiscountLastPrice: null
		});
		expect(saved!.relistAt).toEqual(due);
	});

	it('keeps the price anchors and the due date when the relist fails', async () => {
		relistMock.mockResolvedValue({ status: 400, message: 'eBay said no' });
		await seed('item-1', {
			relistDiscountEnabled: true,
			relistDiscountPercent: 5,
			relistDiscountMaxPercent: 20,
			relistDiscountBasePrice: 100,
			relistDiscountLastPrice: 95
		});

		const body = await (await callCron(authorized)).json();

		expect(body).toEqual({ processed: 1, succeeded: 0, failed: 1 });
		const saved = await load('item-1');
		expect(saved).toMatchObject({
			lastRelistResult: 'failed: eBay said no',
			relistAttemptCount: 1,
			relistDiscountBasePrice: 100,
			relistDiscountLastPrice: 95
		});
		expect(saved!.relistAt).toEqual(due);
	});

	it('records a thrown error as a failure without touching the price anchors', async () => {
		relistMock.mockRejectedValue(new Error('network down'));
		await seed('item-1', { relistDiscountEnabled: true, relistDiscountPercent: 5, relistDiscountMaxPercent: 20 });

		const body = await (await callCron(authorized)).json();

		expect(body).toEqual({ processed: 1, succeeded: 0, failed: 1 });
		expect(await load('item-1')).toMatchObject({
			lastRelistResult: 'error: network down',
			relistDiscountBasePrice: null,
			relistDiscountLastPrice: null
		});
	});

	it('ignores items that are not due', async () => {
		await db.updateEbayMetadata(
			USER,
			'item-1',
			{ relistEnabled: true, relistAt: new Date(Date.now() + DAY_MS), relistDiscountEnabled: true },
			true
		);

		const body = await (await callCron(authorized)).json();

		expect(body).toEqual({ processed: 0, succeeded: 0, failed: 0 });
		expect(relistMock).not.toHaveBeenCalled();
	});
});
