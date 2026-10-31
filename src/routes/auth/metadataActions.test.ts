import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { clearTestMongo, startTestMongo, stopTestMongo } from '../../test/mongo';

// The pages import the eBay client for their loaders, which these action tests do not need.
vi.mock('$lib/server/ebayUtils', () => ({
	getMyEbayOrders: vi.fn(),
	getMyEbaySellingActive: vi.fn(),
	getMyEbaySellingScheduled: vi.fn(),
	getMyEbaySellingSold: vi.fn(),
	findItemsByKeywords: vi.fn()
}));

await startTestMongo();
const db = await import('$lib/server/DatabaseUtils');
const { EbayItemMetadata } = await import('$lib/server/models/ebay-item-metadata');
const { PoshmarkItemMetadata } = await import('$lib/server/models/poshmark-item-metadata');

const cases = [
	{ route: 'sold-items', model: EbayItemMetadata, actions: (await import('./sold-items/+page.server')).actions, seed: db.updateEbayMetadata },
	{ route: 'scheduled-items', model: EbayItemMetadata, actions: (await import('./scheduled-items/+page.server')).actions, seed: db.updateEbayMetadata },
	{ route: 'poshmark-active-items', model: EbayItemMetadata, actions: (await import('./poshmark-active-items/+page.server')).actions, seed: db.updateEbayMetadata },
	{ route: 'poshmark-sold-items', model: PoshmarkItemMetadata, actions: (await import('./poshmark-sold-items/+page.server')).actions, seed: db.updatePoshmarkMetadata }
];

// Some checks query the models directly, which needs the connection the app's request hooks normally open.
beforeAll(() => db.connectToDatabase());
afterEach(clearTestMongo);
afterAll(stopTestMongo);

describe.each(cases)('$route updateItem', ({ model, actions, seed }) => {
	function call(metaData: unknown, { sessionUser = 'user-1', formUserId }: { sessionUser?: string | null; formUserId?: string } = {}) {
		const formData = new FormData();
		formData.set('itemId', 'item-1');
		if (formUserId !== undefined) formData.set('userId', formUserId);
		formData.set('metaData', JSON.stringify(metaData));
		const request = new Request('http://localhost', { method: 'POST', body: formData });
		return (actions.updateItem as any)({ request, locals: { session: sessionUser ? { userId: sessionUser } : null } });
	}

	const load = (itemId = 'item-1') => (model as any).findOne({ itemId }).lean().exec();

	it('returns 401 and writes nothing when nobody is signed in', async () => {
		const result = await call({ purchasePrice: 1 }, { sessionUser: null, formUserId: 'user-1' });

		expect(result.status).toBe(401);
		expect(await load()).toBeNull();
	});

	it('saves under the signed-in user even when the form claims another user', async () => {
		const result = await call({ purchasePrice: 1 }, { sessionUser: 'user-1', formUserId: 'someone-else' });

		expect(result).toMatchObject({ success: true });
		expect(await load()).toMatchObject({ userId: 'user-1', purchasePrice: 1 });
	});

	it('cannot be used to overwrite another users record through the form userId', async () => {
		await (seed as any)('owner', 'item-1', { purchasePrice: 1 }, true);

		await call({ purchasePrice: 999 }, { sessionUser: 'intruder', formUserId: 'owner' });

		expect(await (model as any).findOne({ userId: 'owner', itemId: 'item-1' }).lean().exec()).toMatchObject({ purchasePrice: 1 });
	});

	it('does not let metadata reassign the record to another user or item id', async () => {
		await call({ purchasePrice: 1 });

		const result = await call({ purchasePrice: 2, userId: 'someone-else', itemId: 'other-item', _id: 'x' });

		expect(result).toMatchObject({ success: true });
		expect(await load()).toMatchObject({ userId: 'user-1', itemId: 'item-1', purchasePrice: 2 });
		expect(await load('other-item')).toBeNull();
	});

	it('returns 400 for metadata that is not a JSON object', async () => {
		const formData = new FormData();
		formData.set('itemId', 'item-1');
		formData.set('metaData', '[]');
		const request = new Request('http://localhost', { method: 'POST', body: formData });

		const result = await (actions.updateItem as any)({ request, locals: { session: { userId: 'user-1' } } });

		expect(result.status).toBe(400);
	});
});
