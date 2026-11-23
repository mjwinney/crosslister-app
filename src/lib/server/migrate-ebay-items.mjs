import { BSON } from 'mongodb';

/** @import { Db, Document, Collection } from 'mongodb' */

const listingFields = ['title', 'pictureURL', 'listedTime'];
const soldFields = ['soldPrice', 'soldTime', 'feePrice', 'shippingLabelCost', 'addFeeGeneral', 'finalShippingCost'];
const knownFields = new Set(['_id', '__v', 'userId', 'itemId', 'StartTime', 'createdAt', ...listingFields, ...soldFields]);

/** @param {Document} record @param {boolean} metadata */
function itemIdFor(record, metadata) {
	if (typeof record.itemId === 'string' && record.itemId.trim()) return record.itemId;
	// Older metadata used the eBay item ID as its string _id.
	if (metadata && !Object.hasOwn(record, 'itemId') && typeof record._id === 'string' && record._id.trim()) return record._id;
	return undefined;
}

/** @param {Document} record @param {string} name */
function nested(record, name) {
	const value = record[name];
	if (value != null && (typeof value !== 'object' || Array.isArray(value) || value instanceof Date)) {
		throw new Error(`Invalid ${name} object`);
	}
	return value ?? {};
}

/** @param {Collection} source @param {Document} record */
function recordKey(source, record) {
	return `${source.collectionName}:${BSON.EJSON.stringify(record._id)}`;
}

/**
 * Migrate one user's eBay records. Run with writes for that user stopped.
 * Existing embedded values take precedence over legacy values.
 * @param {Db} db
 * @param {string} userId
 */
export async function migrateEbayItems(db, userId) {
	if (!userId || !userId.trim()) throw new Error('A non-empty user ID is required');

	const items = db.collection('ebayitemmetadatas');
	const active = db.collection('ebayactiveitems');
	const sold = db.collection('ebaysolditems');
	const sources = [items, active, sold];
	let metadataCount = 0;
	let activeCount = 0;
	let soldCount = 0;
	/** @type {Array<{ collection: string, documentId: string, itemId?: string, reason: string }>} */
	const issues = [];
	/** @type {Map<string, string>} */
	const invalidRecords = new Map();
	/** @type {Map<string, string>} */
	const blockedItems = new Map();

	// Identify ambiguous items before writing anything, so another collection cannot overwrite them.
	for (const source of sources) {
		const metadata = source === items;
		for await (const record of source.find({ userId })) {
			const itemId = itemIdFor(record, metadata);
			/** @type {string | undefined} */
			let reason;
			if (!itemId) {
				const type = !Object.hasOwn(record, 'itemId') ? 'missing' : record.itemId === null ? 'null' : typeof record.itemId;
				reason = `Invalid itemId (${type}); cannot safely determine the item ID`;
			} else if (metadata) {
				try {
					nested(record, 'listing');
					nested(record, 'sold');
				} catch (error) {
					reason = error instanceof Error ? error.message : String(error);
				}
			} else {
				const unknown = Object.keys(record).filter((key) => !knownFields.has(key));
				if (unknown.length) reason = `Unsupported fields: ${unknown.join(', ')}`;
			}
			if (reason) {
				invalidRecords.set(recordKey(source, record), reason);
				if (itemId) blockedItems.set(itemId, `Related record in ${source.collectionName}: ${reason}`);
			}
		}

		const derivedId = metadata
			? { $cond: [{ $eq: [{ $type: '$itemId' }, 'missing'] }, '$_id', '$itemId'] }
			: '$itemId';
		for await (const duplicate of source.aggregate([
			{ $match: { userId } },
			{ $project: { derivedId } },
			{ $match: { derivedId: { $type: 'string', $ne: '' } } },
			{ $group: { _id: '$derivedId', count: { $sum: 1 } } },
			{ $match: { count: { $gt: 1 } } }
		])) {
			blockedItems.set(duplicate._id, `Duplicate records in ${source.collectionName}`);
		}
	}

	/** @param {Collection} source @param {Document} record @param {string | undefined} itemId @param {string} reason */
	function report(source, record, itemId, reason) {
		issues.push({ collection: source.collectionName, documentId: String(record._id), ...(itemId ? { itemId } : {}), reason });
	}

	for (const source of sources) {
		const metadata = source === items;
		for await (const record of source.find({ userId })) {
			const itemId = itemIdFor(record, metadata);
			const reason = invalidRecords.get(recordKey(source, record)) ?? (itemId ? blockedItems.get(itemId) : undefined);
			if (reason || !itemId) {
				report(source, record, itemId, reason ?? 'Cannot safely determine the item ID');
				continue;
			}

			try {
				if (metadata) {
					const listing = nested(record, 'listing');
					const sale = nested(record, 'sold');
					const legacyActive = await active.findOne({ userId, itemId });
					/** @type {Document} */
					const set = {};
					/** @type {Document} */
					const unset = {};
					if (!Object.hasOwn(record, 'itemId')) set.itemId = itemId;
					if (record.listing === null) set.listing = {};
					if (record.sold === null) set.sold = {};
					for (const [fields, name, target] of [[listingFields, 'listing', listing], [soldFields, 'sold', sale]]) {
						for (const field of fields) {
							if (Object.hasOwn(record, field)) {
								if (!Object.hasOwn(target, field)) {
									const value = field === 'listedTime' ? (legacyActive?.StartTime ?? record[field]) : record[field];
									if (record[name] === null) set[name][field] = value;
									else set[`${name}.${field}`] = value;
								}
								unset[field] = '';
							}
						}
					}
					if (Object.keys(set).length || Object.keys(unset).length) {
						const result = await items.updateOne({ _id: record._id, userId }, {
							...(Object.keys(set).length ? { $set: set } : {}),
							...(Object.keys(unset).length ? { $unset: unset } : {})
						});
						if (result.matchedCount !== 1) throw new Error('Metadata record was not found during update');
					}
					metadataCount++;
				} else {
					const key = { userId, itemId };
					const existing = await items.findOne(key);
					const listing = nested(existing ?? {}, 'listing');
					const sale = nested(existing ?? {}, 'sold');
					/** @type {Document} */
					const set = {};
					for (const field of listingFields) {
						const value = field === 'listedTime' ? (record.listedTime ?? record.StartTime) : record[field];
						if (value !== undefined && !Object.hasOwn(listing, field)) set[`listing.${field}`] = value;
					}
					for (const field of soldFields) {
						if (record[field] !== undefined && !Object.hasOwn(sale, field)) set[`sold.${field}`] = record[field];
					}
					await items.updateOne(key, {
						...(Object.keys(set).length ? { $set: set } : {}),
						$setOnInsert: {
							createdAt: record.createdAt ?? new Date(),
							relistEnabled: false, relistAt: null, relistAttemptCount: 0,
							relistDiscountEnabled: false, relistDiscountPercent: 5, relistDiscountMaxPercent: 20,
							relistDiscountBasePrice: null, relistDiscountLastPrice: null
						}
					}, { upsert: true });
					const deleted = await source.deleteOne({ _id: record._id, userId });
					if (deleted.deletedCount !== 1) throw new Error('Legacy record was not found during deletion');
					if (source === active) activeCount++; else soldCount++;
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				report(source, record, itemId, message);
				blockedItems.set(itemId, `Previous migration failure in ${source.collectionName}: ${message}`);
			}
		}
	}
	return { metadataCount, activeCount, soldCount, issues };
}
