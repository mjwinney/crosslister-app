import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { clearTestMongo, startTestMongo, stopTestMongo } from '../../test/mongo';

// The in-memory server must be running before DatabaseUtils reads MONGODB_URI at import time.
await startTestMongo();
const db = await import('./DatabaseUtils');
const { EbayItemMetadata } = await import('./models/ebay-item-metadata');

const USER = 'user-1';

const discountFields = {
	relistEnabled: true,
	relistDiscountEnabled: true,
	relistDiscountPercent: 10,
	relistDiscountMaxPercent: 15,
	relistDiscountBasePrice: 100,
	relistDiscountLastPrice: 90
};

afterEach(clearTestMongo);
afterAll(stopTestMongo);

async function load(itemId: string, userId = USER) {
	return EbayItemMetadata.findOne({ itemId, userId }).lean().exec();
}

describe('updateEbayMetadata', () => {
	it('upserts a record and persists the discount fields', async () => {
		const status = await db.updateEbayMetadata(USER, 'item-1', discountFields, true);
		expect(status).toBe(db.StatusCodes.OK);

		const saved = await load('item-1');
		expect(saved).toMatchObject(discountFields);
	});

	it('applies the schema defaults for the discount fields', async () => {
		await db.updateEbayMetadata(USER, 'item-1', { purchasePrice: 5 }, true);

		const saved = await load('item-1');
		expect(saved).toMatchObject({
			relistDiscountEnabled: false,
			relistDiscountPercent: 5,
			relistDiscountMaxPercent: 20,
			relistDiscountBasePrice: null,
			relistDiscountLastPrice: null
		});
	});

	it('does not create a record when upsert is false', async () => {
		const status = await db.updateEbayMetadata(USER, 'missing', { purchasePrice: 5 });
		expect(status).toBe(db.StatusCodes.BadRequest);
		expect(await load('missing')).toBeNull();
	});

	it('clears the base and last prices when null is saved', async () => {
		await db.updateEbayMetadata(USER, 'item-1', discountFields, true);
		await db.updateEbayMetadata(USER, 'item-1', { relistDiscountBasePrice: null, relistDiscountLastPrice: null });

		const saved = await load('item-1');
		expect(saved?.relistDiscountBasePrice).toBeNull();
		expect(saved?.relistDiscountLastPrice).toBeNull();
		expect(saved?.relistDiscountPercent).toBe(10);
	});

	it('leaves other users records alone', async () => {
		await db.updateEbayMetadata('user-2', 'item-1', { purchasePrice: 1 }, true);
		await db.updateEbayMetadata(USER, 'item-1', { purchasePrice: 2 }, true);

		expect((await load('item-1', 'user-2'))?.purchasePrice).toBe(1);
		expect((await load('item-1', USER))?.purchasePrice).toBe(2);
	});

	describe('originalListedAt', () => {
		const first = new Date('2026-01-01T00:00:00.000Z');
		const second = new Date('2026-02-01T00:00:00.000Z');

		it('is set from currentListedAt on first insert', async () => {
			await db.updateEbayMetadata(USER, 'item-1', { currentListedAt: first }, true);

			const saved = await load('item-1');
			expect(saved?.originalListedAt).toEqual(first);
			expect(saved?.currentListedAt).toEqual(first);
		});

		it('is never overwritten by later updates', async () => {
			await db.updateEbayMetadata(USER, 'item-1', { currentListedAt: first }, true);
			await db.updateEbayMetadata(USER, 'item-1', { currentListedAt: second, originalListedAt: second });

			const saved = await load('item-1');
			expect(saved?.originalListedAt).toEqual(first);
			expect(saved?.currentListedAt).toEqual(second);
		});

		it('is backfilled when an existing record has none', async () => {
			await EbayItemMetadata.create({ itemId: 'item-1', userId: USER });
			await db.updateEbayMetadata(USER, 'item-1', { currentListedAt: second });

			expect((await load('item-1'))?.originalListedAt).toEqual(second);
		});
	});
});

describe('relist reads', () => {
	const due = new Date('2026-01-01T00:00:00.000Z');
	const now = new Date('2026-06-01T00:00:00.000Z');

	async function seedDue() {
		await db.updateEbayMetadata(USER, 'item-1', { ...discountFields, relistAt: due }, true);
	}

	it('getDueRelistGroupsByUser returns the discount fields', async () => {
		await seedDue();

		const result = await db.getDueRelistGroupsByUser(now, 10, 10);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data).toHaveLength(1);
		expect(result.data[0].userId).toBe(USER);
		expect(result.data[0].items[0]).toMatchObject({ itemId: 'item-1', metadata: discountFields });
	});

	it('getDueRelistGroupsByUser skips items that are not due or not enabled', async () => {
		await db.updateEbayMetadata(USER, 'future', { relistEnabled: true, relistAt: new Date('2027-01-01T00:00:00.000Z') }, true);
		await db.updateEbayMetadata(USER, 'off', { relistEnabled: false, relistAt: due }, true);

		const result = await db.getDueRelistGroupsByUser(now, 10, 10);
		expect(result.ok && result.data).toEqual([]);
	});

	it('getItemsDueForRelist returns the discount fields', async () => {
		await seedDue();

		const result = await db.getItemsDueForRelist(now);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data[0]).toMatchObject({ itemId: 'item-1', userId: USER, metadata: discountFields });
	});

	it('getEbayMetadata returns the discount fields', async () => {
		await seedDue();

		const result = await db.getEbayMetadata(USER, 'item-1');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data).toMatchObject(discountFields);
	});
});

describe('replaceEbayItemId', () => {
	it('moves the record to the new id and keeps the discount fields', async () => {
		const listedAt = new Date('2026-03-01T00:00:00.000Z');
		await db.updateEbayMetadata(USER, 'old-id', { ...discountFields, purchasePrice: 12 }, true);

		const status = await db.replaceEbayItemId(USER, 'old-id', 'new-id', listedAt);
		expect(status).toBe(db.StatusCodes.OK);

		expect(await load('old-id')).toBeNull();
		const moved = await load('new-id');
		expect(moved).toMatchObject({ ...discountFields, purchasePrice: 12 });
		expect(moved?.currentListedAt).toEqual(listedAt);
	});
});

describe('markRelistSuccess / markRelistFailure', () => {
	it('markRelistSuccess schedules the next relist and resets the attempt count', async () => {
		await db.updateEbayMetadata(USER, 'item-1', { relistEnabled: true, relistAttemptCount: 3 }, true);
		const listedAt = new Date('2026-04-01T00:00:00.000Z');

		const status = await db.markRelistSuccess(USER, 'item-1', { listedAt, intervalDays: 30 });
		expect(status).toBe(db.StatusCodes.OK);

		const saved = await load('item-1');
		expect(saved?.relistAttemptCount).toBe(0);
		expect(saved?.lastRelistResult).toBe('success');
		expect(saved?.relistAt).toEqual(new Date('2026-05-01T00:00:00.000Z'));
	});

	it('markRelistSuccess rejects a non-positive interval', async () => {
		expect(await db.markRelistSuccess(USER, 'item-1', { intervalDays: 0 })).toBe(db.StatusCodes.BadRequest);
	});

	it('markRelistFailure increments the attempt count and records the reason', async () => {
		await db.updateEbayMetadata(USER, 'item-1', { relistEnabled: true }, true);

		await db.markRelistFailure(USER, 'item-1', 'boom');
		await db.markRelistFailure(USER, 'item-1', 'boom again');

		const saved = await load('item-1');
		expect(saved?.relistAttemptCount).toBe(2);
		expect(saved?.lastRelistResult).toBe('boom again');
	});

	it('markRelistFailure reports a missing record', async () => {
		expect(await db.markRelistFailure(USER, 'missing', 'boom')).toBe(db.StatusCodes.NotFound);
	});
});
