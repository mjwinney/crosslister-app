import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { clearTestMongo, startTestMongo, stopTestMongo } from '../../../test/mongo';

// The page server module pulls in the eBay client, which is irrelevant to updateItem.
vi.mock('$lib/server/ebayUtils', () => ({
	getMyEbaySellingActive: vi.fn(),
	getMyEbaySellingSold: vi.fn(),
	findItemsByKeywords: vi.fn(),
	relistEbayItemsWithPriceChange: vi.fn()
}));

await startTestMongo();
const db = await import('$lib/server/DatabaseUtils');
const { EbayItemMetadata } = await import('$lib/server/models/ebay-item-metadata');
const { actions } = await import('./+page.server');

const USER = 'user-1';

// The action queries the model directly and relies on the app's request hooks having opened the connection.
beforeAll(() => db.connectToDatabase());
afterEach(clearTestMongo);
afterAll(stopTestMongo);

const signedIn = { session: { userId: USER } };

// `userId` is the signed-in user; `formUserId` is what the (untrusted) client claims in the form.
async function callUpdateItem(
	metaData: unknown,
	{ itemId = 'item-1', userId = USER, formUserId }: { itemId?: string; userId?: string | null; formUserId?: string } = {}
) {
	const formData = new FormData();
	formData.set('itemId', itemId);
	if (formUserId !== undefined) formData.set('userId', formUserId);
	formData.set('metaData', JSON.stringify(metaData));
	const request = new Request('http://localhost/auth/active-items?/updateItem', { method: 'POST', body: formData });
	return (actions.updateItem as any)({ request, locals: { session: userId ? { userId } : null } });
}

async function load(itemId = 'item-1') {
	return EbayItemMetadata.findOne({ itemId }).lean().exec();
}

const enabledDiscount = {
	relistEnabled: true,
	relistDiscountEnabled: true,
	relistDiscountPercent: 5,
	relistDiscountMaxPercent: 20
};

describe('updateItem', () => {
	it('returns 400 when required form fields are missing', async () => {
		const request = new Request('http://localhost', { method: 'POST', body: new FormData() });
		const result = await (actions.updateItem as any)({ request, locals: signedIn });
		expect(result.status).toBe(400);
	});

	it('returns 400 for invalid JSON metadata', async () => {
		const formData = new FormData();
		formData.set('itemId', 'item-1');
		formData.set('metaData', '{not json');
		const result = await (actions.updateItem as any)({
			request: new Request('http://localhost', { method: 'POST', body: formData }),
			locals: signedIn
		});
		expect(result.status).toBe(400);
	});

	it.each([['null'], ['[]'], ['5']])('returns 400 when metadata is %s rather than an object', async (json) => {
		const formData = new FormData();
		formData.set('itemId', 'item-1');
		formData.set('metaData', json);
		const result = await (actions.updateItem as any)({
			request: new Request('http://localhost', { method: 'POST', body: formData }),
			locals: signedIn
		});
		expect(result.status).toBe(400);
	});

	describe('identity', () => {
		it('returns 401 and writes nothing when nobody is signed in', async () => {
			const result = await callUpdateItem({ purchasePrice: 1 }, { userId: null, formUserId: USER });

			expect(result.status).toBe(401);
			expect(await load()).toBeNull();
		});

		it('saves under the signed-in user even when the form claims another user', async () => {
			const result = await callUpdateItem({ purchasePrice: 1 }, { userId: USER, formUserId: 'someone-else' });

			expect(result).toMatchObject({ success: true });
			expect(await load()).toMatchObject({ userId: USER, purchasePrice: 1 });
		});

		it('does not let a form userId impersonate the owner of an existing item', async () => {
			await db.updateEbayMetadata('owner', 'item-1', { purchasePrice: 1 }, true);

			const result = await callUpdateItem({ purchasePrice: 999 }, { userId: 'intruder', formUserId: 'owner' });

			expect(result.status).toBe(403);
			expect(await load()).toMatchObject({ userId: 'owner', purchasePrice: 1 });
		});

		it('does not let metadata reassign the record to another user or item id', async () => {
			await callUpdateItem({ purchasePrice: 1 });

			const result = await callUpdateItem({ purchasePrice: 2, userId: 'someone-else', itemId: 'other-item', _id: 'x' });

			expect(result).toMatchObject({ success: true });
			expect(await load()).toMatchObject({ userId: USER, itemId: 'item-1', purchasePrice: 2 });
			expect(await load('other-item')).toBeNull();
		});
	});

	it.each([
		['discount equal to max', { relistDiscountPercent: 20, relistDiscountMaxPercent: 20 }],
		['discount above max', { relistDiscountPercent: 20, relistDiscountMaxPercent: 10 }],
		['decimal discount', { relistDiscountPercent: 2.5, relistDiscountMaxPercent: 20 }],
		['max over 50', { relistDiscountPercent: 5, relistDiscountMaxPercent: 51 }],
		['zero discount', { relistDiscountPercent: 0, relistDiscountMaxPercent: 20 }],
		['missing values', {}]
	])('rejects enabling the discount with %s', async (_name, values) => {
		const result = await callUpdateItem({ relistEnabled: true, relistDiscountEnabled: true, ...values });

		expect(result.status).toBe(400);
		expect(await load()).toBeNull();
	});

	it('saves a valid discount and clears the price anchors when it is newly enabled', async () => {
		await db.updateEbayMetadata(USER, 'item-1', { relistDiscountBasePrice: 99, relistDiscountLastPrice: 88 }, true);

		const result = await callUpdateItem({ ...enabledDiscount, relistDiscountBasePrice: 77, relistDiscountLastPrice: 66 });

		expect(result).toMatchObject({ success: true });
		expect(await load()).toMatchObject({
			relistDiscountEnabled: true,
			relistDiscountPercent: 5,
			relistDiscountMaxPercent: 20,
			relistDiscountBasePrice: null,
			relistDiscountLastPrice: null
		});
	});

	it('rejects changing the percentages while the discount is enabled', async () => {
		await callUpdateItem(enabledDiscount);

		const result = await callUpdateItem({ ...enabledDiscount, relistDiscountPercent: 8 });

		expect(result.status).toBe(400);
		expect(await load()).toMatchObject({ relistDiscountPercent: 5, relistDiscountMaxPercent: 20 });
	});

	it('does not let a stale client overwrite the price anchors set by the relist job', async () => {
		await callUpdateItem(enabledDiscount);
		await db.updateEbayMetadata(USER, 'item-1', { relistDiscountBasePrice: 100, relistDiscountLastPrice: 95 });

		// An unrelated edit (e.g. purchase price) sent with stale anchors from the page.
		const result = await callUpdateItem({
			...enabledDiscount,
			purchasePrice: 12,
			relistDiscountBasePrice: null,
			relistDiscountLastPrice: 1
		});

		expect(result).toMatchObject({ success: true });
		expect(await load()).toMatchObject({ purchasePrice: 12, relistDiscountBasePrice: 100, relistDiscountLastPrice: 95 });
	});

	it('clears the price anchors when the discount is switched off and keeps the percentages', async () => {
		await callUpdateItem(enabledDiscount);
		await db.updateEbayMetadata(USER, 'item-1', { relistDiscountBasePrice: 100, relistDiscountLastPrice: 95 });

		const result = await callUpdateItem({ relistEnabled: true, relistDiscountEnabled: false });

		expect(result).toMatchObject({ success: true });
		expect(await load()).toMatchObject({
			relistDiscountEnabled: false,
			relistDiscountPercent: 5,
			relistDiscountMaxPercent: 20,
			relistDiscountBasePrice: null,
			relistDiscountLastPrice: null
		});
	});

	it('allows changing the percentages while the discount is disabled', async () => {
		await callUpdateItem({ relistEnabled: true, relistDiscountEnabled: false, relistDiscountPercent: 12, relistDiscountMaxPercent: 30 });

		expect(await load()).toMatchObject({ relistDiscountPercent: 12, relistDiscountMaxPercent: 30 });
	});

	it('returns 403 and changes nothing when the item belongs to another user', async () => {
		await db.updateEbayMetadata('owner', 'item-1', { purchasePrice: 1 }, true);

		const result = await callUpdateItem({ ...enabledDiscount }, { userId: 'intruder' });

		expect(result.status).toBe(403);
		expect(await load()).toMatchObject({ userId: 'owner', purchasePrice: 1, relistDiscountEnabled: false });
	});

	it('clears relistAt when relisting is disabled', async () => {
		await callUpdateItem({ relistEnabled: true, relistAt: '2026-12-01T00:00:00.000Z' });
		await callUpdateItem({ relistEnabled: false, relistAt: '2026-12-01T00:00:00.000Z' });

		expect((await load())?.relistAt).toBeNull();
	});
});
