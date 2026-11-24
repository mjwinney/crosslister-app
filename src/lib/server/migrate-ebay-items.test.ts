import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MongoClient, ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestMongo, stopTestMongo } from '../../test/mongo';

await startTestMongo();
const database = await import('./DatabaseUtils');
const { getMyEbayOrdersDates, getMyEbaySellingActive, buildTransactionLedger } = await import('./ebayUtils');
const { migrateEbayItems } = await import('./migrate-ebay-items.mjs');
const client = new MongoClient(process.env.TEST_MONGODB_URI!);
const execFileAsync = promisify(execFile);
const userId = 'user-1';
const listedTime = new Date('2026-01-02T00:00:00Z');
const soldTime = new Date('2026-02-02T00:00:00Z');
const from = new Date('2026-02-01T00:00:00Z');
const to = new Date('2026-02-28T00:00:00Z');

beforeAll(async () => {
	await client.connect();
	await database.connectToDatabase();
});
afterEach(async () => {
	vi.unstubAllGlobals();
	await client.db().dropDatabase();
});
afterAll(async () => {
	await client.close();
	await stopTestMongo();
});

describe('eBay item migration', () => {
	it('runs the CLI for one user, embeds data, preserves reports, and is repeatable', async () => {
		const db = client.db();
		const items = db.collection('ebayitemmetadatas');
		const active = db.collection('ebayactiveitems');
		const sold = db.collection('ebaysolditems');
		await items.insertMany([
			{ userId, itemId: 'item-1', title: 'Old title', listedTime, soldTime, soldPrice: 0, feePrice: 4, finalShippingCost: -2, purchasePrice: 8, purchaseLocation: 'shop', relistEnabled: true },
			{ userId: 'user-2', itemId: 'item-1', title: 'Other user', soldTime, soldPrice: 99 }
		]);
		await active.insertMany([
			{ userId, itemId: 'item-1', StartTime: listedTime },
			{ userId, itemId: 'active-only', StartTime: listedTime },
			{ userId: 'user-2', itemId: 'item-1', StartTime: listedTime }
		]);
		await sold.insertOne({ userId, itemId: 'item-1', shippingLabelCost: 6 });
		const before = await database.getEbaySoldItemsForReport(userId, from, to);
		const env = { ...process.env, MONGODB_URI: process.env.TEST_MONGODB_URI };
		await execFileAsync(process.execPath, ['scripts\\migrate-ebay-items.mjs', userId], { env });

		expect(await items.findOne({ userId, itemId: 'item-1' })).toMatchObject({
			listing: { title: 'Old title', listedTime },
			sold: { soldTime, soldPrice: 0, feePrice: 4, finalShippingCost: -2, shippingLabelCost: 6 },
			purchasePrice: 8, purchaseLocation: 'shop', relistEnabled: true
		});
		const migrated = await items.findOne({ userId, itemId: 'item-1' });
		expect(migrated).not.toHaveProperty('title');
		expect(migrated).not.toHaveProperty('soldPrice');
		expect(await items.findOne({ userId, itemId: 'active-only' })).toMatchObject({ listing: { listedTime } });
		expect(await active.countDocuments({ userId })).toBe(0);
		expect(await sold.countDocuments({ userId })).toBe(0);
		expect(await items.findOne({ userId: 'user-2', itemId: 'item-1' })).toMatchObject({ title: 'Other user', soldPrice: 99 });
		expect(await active.countDocuments({ userId: 'user-2' })).toBe(1);
		expect(await database.getEbaySoldItemsForReport(userId, from, to)).toEqual(before);
		expect(await migrateEbayItems(db, userId)).toEqual({ metadataCount: 2, activeCount: 0, soldCount: 0, issues: [] });
		expect(await items.findOne({ userId, itemId: 'item-1' })).toEqual(migrated);
	});

	it('keeps embedded values while skipping an unidentifiable legacy record', async () => {
		const db = client.db();
		const items = db.collection('ebayitemmetadatas');
		await items.insertOne({ userId, itemId: 'item-1', title: 'old', soldPrice: 5, listing: { title: 'new' }, sold: { soldPrice: 0 } });
		await db.collection('ebaysolditems').insertOne({ userId, StartTime: listedTime });
		const result = await migrateEbayItems(db, userId);
		expect(result.issues).toMatchObject([{ collection: 'ebaysolditems', reason: 'Invalid itemId (missing); cannot safely determine the item ID' }]);
		expect(await items.findOne({ userId, itemId: 'item-1' })).toMatchObject({ listing: { title: 'new' }, sold: { soldPrice: 0 } });
		expect(await db.collection('ebaysolditems').countDocuments({ userId })).toBe(1);
		await db.collection('ebaysolditems').deleteMany({ userId });
		await migrateEbayItems(db, userId);
		expect(await items.findOne({ userId, itemId: 'item-1' })).toMatchObject({ listing: { title: 'new' }, sold: { soldPrice: 0 } });
	});

	it('migrates historical string _id records and associates their active and sold data', async () => {
		const db = client.db();
		const legacy = db.collection<{ _id: string; userId: string; title: string; soldTime: Date; soldPrice: number }>('ebayitemmetadatas');
		await legacy.insertMany([
			{ _id: '12345', userId, title: 'Historical item', soldTime, soldPrice: 20 },
			{ _id: '67890', userId, title: 'Another item', soldTime, soldPrice: 30 }
		]);
		await db.collection('ebayactiveitems').insertOne({ userId, itemId: '12345', StartTime: listedTime });
		await db.collection('ebaysolditems').insertOne({ userId, itemId: '12345', feePrice: 2 });

		const env = { ...process.env, MONGODB_URI: process.env.TEST_MONGODB_URI };
		await execFileAsync(process.execPath, ['scripts\\migrate-ebay-items.mjs', userId], { env });
		expect(await legacy.findOne({ _id: '12345' })).toMatchObject({
			itemId: '12345', listing: { title: 'Historical item', listedTime }, sold: { soldTime, soldPrice: 20, feePrice: 2 }
		});
		expect(await database.getEbayMetadata(userId, '12345')).toMatchObject({ ok: true, data: { soldPrice: 20, feePrice: 2 } });
		expect(await db.collection('ebayitemmetadatas').findOne({ itemId: '67890', userId })).toMatchObject({
			listing: { title: 'Another item' }, sold: { soldPrice: 30 }
		});
		expect(await db.collection('ebayactiveitems').countDocuments({ userId })).toBe(0);
		expect(await db.collection('ebaysolditems').countDocuments({ userId })).toBe(0);
		await expect(migrateEbayItems(db, userId)).resolves.toMatchObject({ metadataCount: 2, activeCount: 0, soldCount: 0 });
	});

	it('skips collisions and related records while migrating unrelated items', async () => {
		const db = client.db();
		const legacy = db.collection<{ _id: string; userId: string; title: string }>('ebayitemmetadatas');
		await legacy.insertOne({ _id: '12345', userId, title: 'Historical' });
		await db.collection('ebayitemmetadatas').insertOne({ userId, itemId: '12345', title: 'Current' });
		await db.collection('ebayitemmetadatas').insertOne({ userId, itemId: 'safe', title: 'Safe' });
		await db.collection('ebayactiveitems').insertOne({ userId, itemId: '12345', StartTime: listedTime });
		const result = await migrateEbayItems(db, userId);
		expect(result.issues).toHaveLength(3);
		expect(result.issues.every((issue) => issue.reason.includes('Duplicate records'))).toBe(true);
		expect(await legacy.findOne({ _id: '12345' })).toMatchObject({ title: 'Historical' });
		expect(await db.collection('ebayitemmetadatas').findOne({ userId, itemId: '12345' })).toMatchObject({ title: 'Current' });
		expect(await db.collection('ebayactiveitems').countDocuments({ userId, itemId: '12345' })).toBe(1);
		expect(await db.collection('ebayitemmetadatas').findOne({ userId, itemId: 'safe' })).toMatchObject({ listing: { title: 'Safe' } });
	});

	it('reports null item IDs through the CLI and continues migrating valid records', async () => {
		const db = client.db();
		const items = db.collection('ebayitemmetadatas');
		const invalid = await items.insertOne({ userId, itemId: null, title: 'No item ID' });
		await items.insertOne({ userId, itemId: 'valid', title: 'Valid item' });
		await db.collection('ebayactiveitems').insertOne({ userId, itemId: 'valid', StartTime: listedTime });
		const env = { ...process.env, MONGODB_URI: process.env.TEST_MONGODB_URI };
		await expect(execFileAsync(process.execPath, ['scripts\\migrate-ebay-items.mjs', userId], { env })).rejects.toMatchObject({
			code: 1, stderr: expect.stringContaining(`_id=${invalid.insertedId}: Invalid itemId (null)`)
		});
		expect(await items.findOne({ _id: invalid.insertedId })).toMatchObject({ itemId: null, title: 'No item ID' });
		expect(await items.findOne({ userId, itemId: 'valid' })).toMatchObject({ listing: { title: 'Valid item', listedTime } });
		expect(await db.collection('ebayactiveitems').countDocuments({ userId })).toBe(0);
	});

	it('does not delete legacy records with unsupported fields', async () => {
		const db = client.db();
		await db.collection('ebayitemmetadatas').insertMany([
			{ userId, itemId: 'item-1', title: 'Blocked' },
			{ userId, itemId: 'item-2', title: 'Allowed' }
		]);
		await db.collection('ebayactiveitems').insertOne({ userId, itemId: 'item-1', StartTime: listedTime, customData: 'keep' });
		const result = await migrateEbayItems(db, userId);
		expect(result.issues).toHaveLength(2);
		expect(result.issues[1]).toMatchObject({ reason: 'Unsupported fields: customData' });
		expect(await db.collection('ebayactiveitems').countDocuments({ userId })).toBe(1);
		expect(await db.collection('ebayitemmetadatas').findOne({ userId, itemId: 'item-1' })).toMatchObject({ title: 'Blocked' });
		expect(await db.collection('ebayitemmetadatas').findOne({ userId, itemId: 'item-2' })).toMatchObject({ listing: { title: 'Allowed' } });
	});

	it('distinguishes a string _id from an ObjectId with the same text', async () => {
		const db = client.db();
		const id = new ObjectId();
		await db.collection('ebayitemmetadatas').insertOne({ _id: id, userId, itemId: null, title: 'Invalid' });
		const legacy = db.collection<{ _id: string; userId: string; title: string }>('ebayitemmetadatas');
		await legacy.insertOne({ _id: id.toHexString(), userId, title: 'Valid' });
		const result = await migrateEbayItems(db, userId);
		expect(result.issues).toHaveLength(1);
		expect(await legacy.findOne({ _id: id.toHexString() })).toMatchObject({ itemId: id.toHexString(), listing: { title: 'Valid' } });
		expect(await db.collection('ebayitemmetadatas').findOne({ _id: id })).toMatchObject({ itemId: null, title: 'Invalid' });
	});

	it('continues after an individual database write fails and leaves related records untouched', async () => {
		const db = client.db();
		await db.createCollection('ebayitemmetadatas', { validator: { $expr: { $ne: ['$itemId', 'bad'] } } });
		const items = db.collection('ebayitemmetadatas');
		await items.insertOne({ userId, itemId: 'bad', title: 'Bad' }, { bypassDocumentValidation: true });
		await items.insertOne({ userId, itemId: 'good', title: 'Good' });
		await db.collection('ebayactiveitems').insertMany([
			{ userId, itemId: 'bad', StartTime: listedTime },
			{ userId, itemId: 'good', StartTime: listedTime }
		]);

		const result = await migrateEbayItems(db, userId);
		expect(result.issues).toHaveLength(2);
		expect(result.issues[0]).toMatchObject({ collection: 'ebayitemmetadatas', itemId: 'bad' });
		expect(result.issues[1]).toMatchObject({ collection: 'ebayactiveitems', itemId: 'bad', reason: expect.stringContaining('Previous migration failure') });
		expect(await items.findOne({ userId, itemId: 'bad' })).toMatchObject({ title: 'Bad' });
		expect(await db.collection('ebayactiveitems').countDocuments({ userId, itemId: 'bad' })).toBe(1);
		expect(await items.findOne({ userId, itemId: 'good' })).toMatchObject({ listing: { title: 'Good', listedTime } });
		expect(await db.collection('ebayactiveitems').countDocuments({ userId, itemId: 'good' })).toBe(0);
	});

	it('preserves the active start time when legacy metadata has an older listing date', async () => {
		const db = client.db();
		const older = new Date('2025-01-01T00:00:00Z');
		await db.collection('ebayitemmetadatas').insertOne({ userId, itemId: 'item-1', listedTime: older });
		await db.collection('ebayactiveitems').insertOne({ userId, itemId: 'item-1', StartTime: listedTime });
		expect(await database.getEbayListingStart(userId, 'item-1')).toEqual(listedTime);
		await migrateEbayItems(db, userId);
		expect(await database.getEbayListingStart(userId, 'item-1')).toEqual(listedTime);
	});

	it('refuses duplicate legacy records rather than discarding a sale', async () => {
		const db = client.db();
		await db.collection('ebaysolditems').insertMany([
			{ userId, itemId: 'item-1', soldPrice: 3 },
			{ userId, itemId: 'item-1', soldPrice: 7 }
		]);
		const result = await migrateEbayItems(db, userId);
		expect(result.issues).toHaveLength(2);
		expect(result.issues.every((issue) => issue.reason.includes('Duplicate records'))).toBe(true);
		expect(await db.collection('ebaysolditems').countDocuments({ userId })).toBe(2);
		expect(await db.collection('ebayitemmetadatas').countDocuments({ userId })).toBe(0);
	});
});

describe('embedded eBay data', () => {
	it('stores active listings from eBay using a string item ID and gallery image', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response(
			'<GetMyeBaySellingResponse><Ack>Success</Ack><ActiveList><ItemArray><Item><ItemID>12345</ItemID><Title>Listing</Title><GalleryURL>https://example.test/image.jpg</GalleryURL><ListingDetails><StartTime>2026-01-02T00:00:00Z</StartTime></ListingDetails></Item></ItemArray></ActiveList></GetMyeBaySellingResponse>'
		)));
		const locals = { ebayAccessToken: 'test-token', session: { userId } } as App.Locals;
		expect((await getMyEbaySellingActive(locals)).status).toBe(200);
		expect(await client.db().collection('ebayitemmetadatas').findOne({ userId, itemId: '12345' })).toMatchObject({
			listing: { title: 'Listing', listedTime, pictureURL: 'https://example.test/image.jpg' }
		});
		expect(await client.db().collection('ebayactiveitems').countDocuments({ userId })).toBe(0);
	});

	it('waits for order details and finances to be embedded before returning', async () => {
		vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
			const name = new Headers(init?.headers).get('X-EBAY-API-CALL-NAME');
			if (name === 'GetOrders') return new Response(
				'<GetOrdersResponse><OrderArray><Order><OrderID>order-1</OrderID><PaidTime>2026-02-02T00:00:00Z</PaidTime><TransactionArray><Transaction><Item><ItemID>12345</ItemID></Item><TransactionPrice>20</TransactionPrice><ActualShippingCost>4</ActualShippingCost></Transaction></TransactionArray></Order></OrderArray></GetOrdersResponse>'
			);
			if (name === 'GetItem') return new Response(
				'<GetItemResponse><Item><Title>Sold listing</Title><PictureDetails><PictureURL>https://example.test/sold.jpg</PictureURL></PictureDetails><ListingDetails><StartTime>2026-01-02T00:00:00Z</StartTime></ListingDetails></Item></GetItemResponse>'
			);
			return Response.json({ transactions: [
				{ transactionType: 'SHIPPING_LABEL', amount: { value: '2' } },
				{ transactionType: 'SALE', totalFeeAmount: { value: '3' } }
			] });
		}));
		const locals = { ebayAccessToken: 'test-token', session: { userId } } as App.Locals;
		expect((await getMyEbayOrdersDates(locals, to, from)).status).toBe(200);
		expect(await client.db().collection('ebayitemmetadatas').findOne({ userId, itemId: '12345' })).toMatchObject({
			listing: { title: 'Sold listing', listedTime, pictureURL: 'https://example.test/sold.jpg' },
			sold: { soldTime, soldPrice: 20, feePrice: 3, shippingLabelCost: 2, finalShippingCost: 2 }
		});
	});

	it('stores listing and sale fields separately and reads them in reports and summaries', async () => {
		expect(await database.updateEbayMetadata(userId, 'item-1', {
			title: 'Listing', listedTime, soldTime, soldPrice: 0, feePrice: 2,
			shippingLabelCost: 5, finalShippingCost: -3, purchasePrice: 7
		}, true)).toBe(database.StatusCodes.OK);
		const item = await client.db().collection('ebayitemmetadatas').findOne({ userId, itemId: 'item-1' });
		expect(item).toMatchObject({
			listing: { title: 'Listing', listedTime },
			sold: { soldTime, soldPrice: 0, feePrice: 2, shippingLabelCost: 5, finalShippingCost: -3 },
			purchasePrice: 7
		});
		expect(item).not.toHaveProperty('soldTime');
		expect(item).not.toHaveProperty('title');
		expect(await database.getEbayMetadata(userId, 'item-1')).toMatchObject({ ok: true, data: { soldPrice: 0, feePrice: 2 } });
		expect(await database.getEbaySoldItemsForReport(userId, from, to)).toMatchObject({
			ok: true, data: [{ itemId: 'item-1', title: 'Listing', soldPrice: 0, purchasePrice: 7 }]
		});
		expect(await database.getEbayMetadataByDate(userId, from, to)).toMatchObject({
			ok: true, data: { itemCount: 1, grossSales: 0, totalFees: 2, totalPurchasePrice: 7, finalShippingCost: -3 }
		});
	});

	it('prefers updated embedded sale dates over stale legacy dates', async () => {
		await client.db().collection('ebayitemmetadatas').insertOne({ userId, itemId: 'item-1', soldTime, soldPrice: 12 });
		await database.updateEbayMetadata(userId, 'item-1', { soldTime: new Date('2026-03-01T00:00:00Z') });
		expect(await database.getEbaySoldItemsForReport(userId, from, to)).toEqual({ ok: true, data: [] });
	});

	it('preserves relist defaults when reading legacy records without those fields', async () => {
		await client.db().collection('ebayitemmetadatas').insertOne({ userId, itemId: 'item-1' });
		expect(await database.getEbayMetadata(userId, 'item-1')).toMatchObject({
			ok: true,
			data: { relistEnabled: false, relistDiscountEnabled: false, relistDiscountPercent: 5, relistDiscountMaxPercent: 20 }
		});
	});
});

describe('transaction ledger', () => {
	it('builds a ledger from a simple sale with fees', async () => {
		const transactions = [
			{
				transactionType: 'SALE',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '50.00' },
				bookingEntry: 'CREDIT'
			},
			{
				transactionType: 'NON_SALE_CHARGE',
				feeType: 'FINAL_VALUE_FEE',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '-5.00' },
				bookingEntry: 'DEBIT'
			}
		];
		const orderId = '12-34567-89101';
		const ledger = buildTransactionLedger(transactions, orderId);

		expect(ledger).toBeDefined();
		expect(ledger?.transactions).toHaveLength(2);
		expect(ledger?.totalSaleAmount).toBe(50.00);
		expect(ledger?.totalFees).toBe(-5.00);
		expect(ledger?.netAmount).toBe(45.00);
	});

	it('builds a ledger from a refunded order', async () => {
		const transactions = [
			{
				transactionType: 'SALE',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '42.99' },
				bookingEntry: 'CREDIT'
			},
			{
				transactionType: 'NON_SALE_CHARGE',
				feeType: 'FINAL_VALUE_FEE',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '-5.17' },
				bookingEntry: 'DEBIT'
			},
			{
				transactionType: 'SHIPPING_LABEL',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '-6.50' },
				bookingEntry: 'DEBIT'
			},
			{
				transactionType: 'REFUND',
				transactionDate: '2026-02-10T00:00:00Z',
				amount: { value: '-42.99' },
				bookingEntry: 'DEBIT'
			},
			{
				transactionType: 'NON_SALE_CHARGE',
				feeType: 'RETURN_LABEL_CHARGE',
				transactionDate: '2026-02-10T00:00:00Z',
				amount: { value: '-7.20' },
				bookingEntry: 'DEBIT'
			},
			{
				transactionType: 'CREDIT',
				transactionDate: '2026-02-10T00:00:00Z',
				amount: { value: '5.17' },
				bookingEntry: 'CREDIT'
			}
		];
		const orderId = '12-34567-89101';
		const ledger = buildTransactionLedger(transactions, orderId);

		expect(ledger).toBeDefined();
		expect(ledger?.transactions).toHaveLength(6);
		expect(ledger?.totalSaleAmount).toBe(42.99);
		expect(ledger?.totalRefunds).toBe(-42.99);
		expect(ledger?.totalFees).toBe(-5.17 + 5.17); // Fee credit offsetting FVF
		expect(ledger?.totalShippingLabels).toBe(-6.50 - 7.20); // Both label costs (shipping and return)
		expect(ledger?.netAmount).toBe(-13.70);
	});

	it('handles a partial refund with selective fee credit', async () => {
		const transactions = [
			{
				transactionType: 'SALE',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '100.00' },
				bookingEntry: 'CREDIT'
			},
			{
				transactionType: 'NON_SALE_CHARGE',
				feeType: 'FINAL_VALUE_FEE',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '-10.00' },
				bookingEntry: 'DEBIT'
			},
			{
				transactionType: 'REFUND',
				transactionDate: '2026-02-10T00:00:00Z',
				amount: { value: '-50.00' },
				bookingEntry: 'DEBIT'
			},
			{
				transactionType: 'CREDIT',
				transactionDate: '2026-02-10T00:00:00Z',
				amount: { value: '5.00' },
				bookingEntry: 'CREDIT'
			}
		];
		const ledger = buildTransactionLedger(transactions);

		expect(ledger?.netAmount).toBe(45.00);
	});

	it('handles shipping labels correctly', async () => {
		const transactions = [
			{
				transactionType: 'SALE',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '30.00' },
				bookingEntry: 'CREDIT'
			},
			{
				transactionType: 'SHIPPING_LABEL',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '-5.00' },
				bookingEntry: 'DEBIT'
			},
			{
				transactionType: 'NON_SALE_CHARGE',
				feeType: 'FINAL_VALUE_FEE',
				transactionDate: '2026-02-02T00:00:00Z',
				amount: { value: '-3.00' },
				bookingEntry: 'DEBIT'
			}
		];
		const ledger = buildTransactionLedger(transactions);

		expect(ledger?.totalSaleAmount).toBe(30.00);
		expect(ledger?.totalShippingLabels).toBe(-5.00);
		expect(ledger?.totalFees).toBe(-3.00);
		expect(ledger?.netAmount).toBe(22.00);
	});

	it('returns undefined for empty transactions', async () => {
		const ledger = buildTransactionLedger(null);
		expect(ledger).toBeUndefined();
	});

	it('returns undefined for empty transaction array', async () => {
		const ledger = buildTransactionLedger([]);
		expect(ledger).toBeUndefined();
	});

	it('embeds transaction ledger in order metadata', async () => {
		vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
			const name = new Headers(init?.headers).get('X-EBAY-API-CALL-NAME');
			if (name === 'GetOrders') return new Response(
				'<GetOrdersResponse><OrderArray><Order><OrderID>order-1</OrderID><PaidTime>2026-02-02T00:00:00Z</PaidTime><TransactionArray><Transaction><Item><ItemID>12345</ItemID></Item><TransactionPrice>50</TransactionPrice><ActualShippingCost>8</ActualShippingCost></Transaction></TransactionArray></Order></OrderArray></GetOrdersResponse>'
			);
			if (name === 'GetItem') return new Response(
				'<GetItemResponse><Item><Title>Test Item</Title><PictureDetails><PictureURL>https://example.test/item.jpg</PictureURL></PictureDetails><ListingDetails><StartTime>2026-01-02T00:00:00Z</StartTime></ListingDetails></Item></GetItemResponse>'
			);
			return Response.json({ transactions: [
				{
					transactionType: 'SALE',
					transactionDate: '2026-02-02T00:00:00Z',
					amount: { value: '50.00' },
					bookingEntry: 'CREDIT'
				},
				{
					transactionType: 'NON_SALE_CHARGE',
					feeType: 'FINAL_VALUE_FEE',
					transactionDate: '2026-02-02T00:00:00Z',
					amount: { value: '-5.00' },
					bookingEntry: 'DEBIT'
				},
				{
					transactionType: 'SHIPPING_LABEL',
					transactionDate: '2026-02-02T00:00:00Z',
					amount: { value: '-8.00' },
					bookingEntry: 'DEBIT'
				}
			] });
		}));
		const locals = { ebayAccessToken: 'test-token', session: { userId } } as App.Locals;
		expect((await getMyEbayOrdersDates(locals, to, from)).status).toBe(200);
		const item = await client.db().collection('ebayitemmetadatas').findOne({ userId, itemId: '12345' });
		expect(item?.sold?.transactionLedger).toBeDefined();
		expect(item?.sold?.transactionLedger?.transactions).toHaveLength(3);
		expect(item?.sold?.transactionLedger?.netAmount).toBe(37.00);
	});
});
