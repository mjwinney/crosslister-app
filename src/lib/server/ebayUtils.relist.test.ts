import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTestMongo, startTestMongo, stopTestMongo } from '../../test/mongo';

// replaceEbayItemId talks to the database, so use the in-memory server rather than a real one.
await startTestMongo();
const { relistEbayItemsWithPriceChange } = await import('./ebayUtils');

const locals = { ebayAccessToken: 'token', session: { userId: 'user-1' } } as unknown as App.Locals;

let livePrice: number | string;
let calls: { name: string; body: string }[];
let getItemStatus: number;

beforeEach(() => {
	livePrice = 100;
	getItemStatus = 200;
	calls = [];

	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init: { headers: Record<string, string>; body: string }) => {
			const name = init.headers['X-EBAY-API-CALL-NAME'];
			calls.push({ name, body: init.body });

			if (name === 'GetItem') {
				const xml = `<GetItemResponse><Ack>Success</Ack><Item><Title>Test item</Title><SellingStatus><CurrentPrice currencyID="USD">${livePrice}</CurrentPrice></SellingStatus></Item></GetItemResponse>`;
				return new Response(xml, { status: getItemStatus });
			}
			if (name === 'AddItem') {
				return new Response(
					'<AddItemResponse><Ack>Success</Ack><ItemID>999</ItemID><StartTime>2026-01-01T00:00:00.000Z</StartTime></AddItemResponse>'
				);
			}
			return new Response('<EndItemResponse><Ack>Success</Ack></EndItemResponse>');
		})
	);
});

afterEach(async () => {
	vi.unstubAllGlobals();
	await clearTestMongo();
});
afterAll(stopTestMongo);

function addItemPrice(): number {
	const addItem = calls.find((call) => call.name === 'AddItem');
	const match = addItem?.body.match(/<StartPrice[^>]*>([\d.]+)<\/StartPrice>/);
	return Number(match?.[1]);
}

describe('relistEbayItemsWithPriceChange validation', () => {
	it.each([
		['a negative discount (price increase)', -1],
		['a discount over 50', 51],
		['a decimal discount', 2.5],
		['NaN', NaN]
	])('rejects %s without calling eBay', async (_name, percent) => {
		const result = await relistEbayItemsWithPriceChange(locals, 'item-1', percent);

		expect(result.status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('rejects an invalid discount pair without calling eBay', async () => {
		const result = await relistEbayItemsWithPriceChange(locals, 'item-1', 20, { maxPercent: 10 });

		expect(result.status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('rejects a zero discount when discount options are supplied', async () => {
		const result = await relistEbayItemsWithPriceChange(locals, 'item-1', 0, { maxPercent: 20 });

		expect(result.status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('fails without adding a listing when the live item cannot be fetched', async () => {
		getItemStatus = 500;

		const result = await relistEbayItemsWithPriceChange(locals, 'item-1', 5);

		expect(result.status).toBe(400);
		expect(calls.map((call) => call.name)).toEqual(['GetItem']);
	});

	it.each([['0'], ['not-a-number']])('fails without adding a listing for a live price of %s', async (price) => {
		livePrice = price;

		const result = await relistEbayItemsWithPriceChange(locals, 'item-1', 5);

		expect(result.status).toBe(400);
		expect(calls.map((call) => call.name)).toEqual(['GetItem']);
	});
});

describe('relistEbayItemsWithPriceChange without discount options', () => {
	it('keeps the price when the discount is 0', async () => {
		const result = await relistEbayItemsWithPriceChange(locals, 'item-1', 0);

		expect(result).toMatchObject({ status: 200, data: { newItemId: '999', newPrice: 100 } });
		expect(addItemPrice()).toBe(100);
		expect(calls.map((call) => call.name)).toEqual(['GetItem', 'AddItem', 'EndItem']);
	});

	it('applies a plain discount to the live price', async () => {
		const result = await relistEbayItemsWithPriceChange(locals, 'item-1', 10);

		expect(result).toMatchObject({ status: 200, data: { newPrice: 90 } });
		expect(addItemPrice()).toBe(90);
	});

	it('allows the maximum discount of 50', async () => {
		const result = await relistEbayItemsWithPriceChange(locals, 'item-1', 50);

		expect(result).toMatchObject({ status: 200, data: { newPrice: 50 } });
	});
});

describe('relistEbayItemsWithPriceChange with discount options', () => {
	async function relist(live: number, options: { maxPercent: number; basePrice?: number | null; lastPrice?: number | null }, percent = 5) {
		livePrice = live;
		return relistEbayItemsWithPriceChange(locals, 'item-1', percent, options);
	}

	it('captures the live price as the base on the first discounted relist', async () => {
		const result = await relist(100, { maxPercent: 20 });

		expect(result).toMatchObject({ status: 200, data: { newPrice: 95, basePrice: 100 } });
		expect(addItemPrice()).toBe(95);
	});

	it('discounts the current price on later relists and keeps the base', async () => {
		const result = await relist(95, { maxPercent: 20, basePrice: 100, lastPrice: 95 });

		expect(result).toMatchObject({ status: 200, data: { newPrice: 90.25, basePrice: 100 } });
	});

	it('stops at the floor and keeps relisting at the floor price', async () => {
		const clamped = await relist(81.45, { maxPercent: 20, basePrice: 100, lastPrice: 81.45 });
		expect(clamped).toMatchObject({ data: { newPrice: 80, basePrice: 100 } });

		const atFloor = await relist(80, { maxPercent: 20, basePrice: 100, lastPrice: 80 });
		expect(atFloor).toMatchObject({ data: { newPrice: 80, basePrice: 100 } });
	});

	it('ends exactly at the maximum when the discount does not divide it (10 / 15)', async () => {
		const first = await relist(100, { maxPercent: 15 }, 10);
		expect(first).toMatchObject({ data: { newPrice: 90, basePrice: 100 } });

		const second = await relist(90, { maxPercent: 15, basePrice: 100, lastPrice: 90 }, 10);
		expect(second).toMatchObject({ data: { newPrice: 85, basePrice: 100 } });

		const third = await relist(85, { maxPercent: 15, basePrice: 100, lastPrice: 85 }, 10);
		expect(third).toMatchObject({ data: { newPrice: 85, basePrice: 100 } });
	});

	it('resets the base to the live price after a manual price edit', async () => {
		const result = await relist(200, { maxPercent: 20, basePrice: 100, lastPrice: 95 });

		expect(result).toMatchObject({ status: 200, data: { newPrice: 190, basePrice: 200 } });
	});

	it('resets the base when only the base is missing', async () => {
		const result = await relist(95, { maxPercent: 20, basePrice: null, lastPrice: 95 });

		expect(result).toMatchObject({ data: { basePrice: 95, newPrice: 90.25 } });
	});
});
