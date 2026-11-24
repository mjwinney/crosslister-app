// src/lib/server/DatabaseUtils.ts
import mongoose, { now } from 'mongoose';
import { MONGODB_URI } from '$env/static/private'; // Assuming you've set up environment variables in SvelteKit
import { EbayToken } from './models/ebay-token';
import { EbayItemMetadata } from './models/ebay-item-metadata';
import { EbaySold } from './models/ebay-sold';
import { EbayReportSync } from './models/ebay-report-sync';
import { PoshmarkItemMetadata } from './models/poshmark-item-metadata';
import { getRelistAt } from '$lib/relistSchedule';
import { getDashboardDateRanges } from '$lib/reports';

let cachedDb: mongoose.Connection | null = null; // Cache for the database connection

export async function connectToDatabase() {
    if (cachedDb) {
        // console.log("Using existing database connection");
        return cachedDb;
    }

    try {
        const db = await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 100, // Maximum number of sockets the MongoDB driver will keep open for this connection
            minPoolSize: 5,   // Minimum number of sockets the MongoDB driver will keep open for this connection
            serverSelectionTimeoutMS: 30000, //  The MongoDB driver will try to find a server for serverSelectionTimeoutMS milliseconds.
            socketTimeoutMS: 45000, // How long the MongoDB driver will wait before killing a socket due to inactivity after initial connection.
            retryWrites: true // Enable retryable writes for fault tolerance (set to false if using a database that does not support them like AWS DocumentDB).
        });
        // console.log("New database connection established");
        cachedDb = db.connection; // Store the Mongoose connection object
        return cachedDb;
    } catch (error) {
        console.error("Failed to connect to database:", error);
        throw error;
    }
}

export enum StatusCodes {
    OK,
    BadRequest,
    NoDatabaseConnection,
    RegisteredUserAlreadyExists,
    ErrorCreatingUser,
    InsertFailed,
    NotFound,
    EmptyTable
}

export interface TransactionRecord {
    orderId?: string;
    transactionType: string;
    transactionDate: Date;
    description: string;
    amount: number;
    bookingEntry: string;
    feeType?: string;
}

export interface TransactionLedger {
    transactions: TransactionRecord[];
    totalSaleAmount?: number;
    totalRefunds?: number;
    totalFees?: number;
    totalShippingLabels?: number;
    totalBuyerShipping?: number;
    netAmount?: number;
}

export interface UpdateEbayTokenParams {
    userId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    browseToken?: string;
    browseExpiresIn?: number;
    sellerUsername?: string;
}

export async function updateEbayToken(params: UpdateEbayTokenParams): Promise<StatusCodes> {
    const { userId, accessToken, refreshToken, expiresIn, browseToken, browseExpiresIn, sellerUsername } = params;
    console.log(`updateEbayToken called for userId=${userId}`);

    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return StatusCodes.NoDatabaseConnection;
    }

    try {
        const now = new Date();
        const updateData: any = { userId };
        
        // Only add fields that were provided
        if (accessToken !== undefined) {
            updateData.accessToken = accessToken;
        }
        if (refreshToken !== undefined) {
            updateData.refreshToken = refreshToken;
        }
        if (expiresIn !== undefined) {
            updateData.expiresAt = new Date(now.getTime() + expiresIn * 1000);
        }
        if (browseToken !== undefined) {
            updateData.browseToken = browseToken;
        }
        if (browseExpiresIn !== undefined) {
            updateData.browseExpiresAt = new Date(now.getTime() + browseExpiresIn * 1000);
        }
        if (sellerUsername !== undefined) {
            updateData.sellerUsername = sellerUsername;
        }   

        // Use upsert to update the token if it exists or create a new entry if it doesn't
        const result = await EbayToken.updateOne({ userId }, updateData,
        { upsert: true } // Create a new document if one doesn't exist
        );
        
        console.log(`updateEbayToken: Result - matched: ${result.matchedCount}, modified: ${result.modifiedCount}, upserted: ${result.upsertedId}`);
        
        return StatusCodes.OK;
    } catch (error) {
        console.error("Error updating eBay token:", error);
        return StatusCodes.ErrorCreatingUser;
    }
}

interface Success<T> {
    status: 'success';
    data: T;
}

interface Failure {
  status: 'error';
  message: string;
}

interface EbayInfo {
    accessToken: string;
    refreshToken: string;
    browseToken?: string;
    browseExpiresAt?: Date;
    refreshTokenStatus: 'valid' | 'expired';
    browseTokenStatus?: 'valid' | 'expired' | 'undefined';
    sellerUsername: string;
}

// Combine them into a discriminated union
type Result<T> = Success<T> | Failure;

// Load a user's stored eBay credentials and annotate token expiry for callers that need to refresh them.
export async function getEbayTokensFromDB(userId: string) : Promise<Result<EbayInfo>>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { status: 'error', message: "No database connection available" };
    }

    try {
        const ebayData = await EbayToken.findOne({ userId }).exec();

        if (!ebayData) {
            return { status: 'error', message: `Error finding eBay data for userId:${userId}` };
        }

        // Mark the eBay token for refresh slightly before expiration to avoid using a token that expires mid-request.
        const now = new Date();
        const bufferTime = 5 * 60 * 1000;
        const refreshTokenExpired = ebayData.expiresAt.getTime() < now.getTime() + bufferTime;
        
        // Determine browse token status: undefined if missing, expired if expired, valid otherwise
        let browseTokenStatus: 'valid' | 'expired' | 'undefined';
        if (!ebayData.browseToken) {
            browseTokenStatus = 'undefined';
        } else if (ebayData.browseExpiresAt && ebayData.browseExpiresAt.getTime() < now.getTime()) {
            browseTokenStatus = 'expired';
        } else {
            browseTokenStatus = 'valid';
        }

        return { status: 'success', data: { 
            accessToken: ebayData.accessToken, 
            refreshToken: ebayData.refreshToken, 
            browseToken: ebayData.browseToken, 
            browseExpiresAt: ebayData.browseExpiresAt,
            refreshTokenStatus: refreshTokenExpired ? 'expired' : 'valid',
            browseTokenStatus,
            sellerUsername: ebayData.sellerUsername
        } };

    } catch (error) {
        console.error(`Error finding eBay data for userId:${userId}`, error);
        return { status: 'error', message: `Thrown Error finding eBay data for userId:${userId}` };
    }
}

// ...existing code...

export async function getEbayListingStart(userId: string, itemId: string): Promise<Date | undefined> {
    const connection = await connectToDatabase();
    if (!connection.db) throw new Error('No database connection available');
    const item = await connection.db.collection('ebayitemmetadatas').findOne({ userId, itemId });
    const legacy = await connection.db.collection('ebayactiveitems').findOne({ userId, itemId });
    return item?.listing?.listedTime ?? legacy?.StartTime ?? item?.listedTime ?? undefined;
}

export async function updateActiveEbayItem(userId: string, itemId: string, updates: Pick<MetaDataModel, 'listedTime' | 'title' | 'pictureURL'>, upsert = false): Promise<StatusCodes> {
    return updateEbayMetadata(userId, itemId, updates, upsert);
}

export type MetaDataModel = {
    itemId?: string,
    purchasePrice?: number,
    soldPrice?: number,
    purchaseDate?: string,
    purchaseLocation?: string,
    storageLocation?: string,
    pictureURL?: string,
    listedTime?: Date,
    soldTime?: Date,
    feePrice?: number,
    shippingLabelCost?: number,
    addFeeGeneral?: number,
    finalShippingCost?: number,
    transactionLedger?: TransactionLedger,
    title?: string,
    originalListedAt?: Date | string | null,
    currentListedAt?: Date | string | null,
    relistEnabled?: boolean,
    relistAt?: Date | string | null,
    lastRelistAttemptAt?: Date | string | null,
    lastRelistResult?: string | null,
    relistAttemptCount?: number | null,
    relistDiscountEnabled?: boolean,
    relistDiscountPercent?: number | null,
    relistDiscountMaxPercent?: number | null,
    relistDiscountBasePrice?: number | null,
    relistDiscountLastPrice?: number | null
}

const listingKeys = ['title', 'pictureURL', 'listedTime'] as const;
const soldKeys = ['soldPrice', 'soldTime', 'feePrice', 'shippingLabelCost', 'addFeeGeneral', 'finalShippingCost', 'transactionLedger'] as const;
const metadataKeys = [
    'purchasePrice', 'purchaseDate', 'purchaseLocation', 'storageLocation',
    'currentListedAt', 'relistEnabled', 'relistAt', 'lastRelistAttemptAt',
    'lastRelistResult', 'relistAttemptCount', 'relistDiscountEnabled',
    'relistDiscountPercent', 'relistDiscountMaxPercent', 'relistDiscountBasePrice',
    'relistDiscountLastPrice'
] as const;
const dateKeys = new Set(['listedTime', 'soldTime', 'currentListedAt', 'originalListedAt', 'relistAt', 'lastRelistAttemptAt']);
const numberKeys = new Set(['purchasePrice', 'soldPrice', 'feePrice', 'shippingLabelCost', 'addFeeGeneral', 'finalShippingCost', 'relistAttemptCount', 'relistDiscountPercent', 'relistDiscountMaxPercent', 'relistDiscountBasePrice', 'relistDiscountLastPrice']);
const booleanKeys = new Set(['relistEnabled', 'relistDiscountEnabled']);
const metadataDefaults = {
    relistEnabled: false, relistAt: null, relistAttemptCount: 0,
    relistDiscountEnabled: false, relistDiscountPercent: 5, relistDiscountMaxPercent: 20,
    relistDiscountBasePrice: null, relistDiscountLastPrice: null
};

function castEbayField(key: string, value: unknown): unknown {
    if (value == null) return value;
    
    // Handle transactionLedger as a pass-through (already well-typed)
    if (key === 'transactionLedger') {
        return value;
    }
    
    if (dateKeys.has(key)) {
        if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') throw new Error(`Invalid date for ${key}`);
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new Error(`Invalid date for ${key}`);
        return date;
    }
    if (numberKeys.has(key)) {
        if (typeof value !== 'number' && typeof value !== 'string') throw new Error(`Invalid number for ${key}`);
        if (value === '') return null;
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error(`Invalid number for ${key}`);
        return number;
    }
    if (booleanKeys.has(key)) {
        if (value === true || value === 1 || value === 'true' || value === '1' || value === 'yes') return true;
        if (value === false || value === 0 || value === 'false' || value === '0' || value === 'no') return false;
        throw new Error(`Invalid boolean for ${key}`);
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new Error(`Invalid string for ${key}`);
    return String(value);
}

// Persist item metadata without allowing later updates to overwrite the original listing date once it is established.
export async function updateEbayMetadata(userId: string, itemId: string, metaDataModel: MetaDataModel, upsert = false) : Promise<StatusCodes>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return StatusCodes.NoDatabaseConnection;
    }

    if (!metaDataModel) {
        return StatusCodes.BadRequest;
    }

    try {
        if (!cachedDb.db) return StatusCodes.NoDatabaseConnection;
        const items = cachedDb.db.collection('ebayitemmetadatas');
        const existingRecord = await items.findOne({ itemId, userId });
        const fieldsToSet: Record<string, unknown> = {};
        for (const [keys, prefix] of [[listingKeys, 'listing.'], [soldKeys, 'sold.'], [metadataKeys, '']] as const) {
            for (const key of keys) {
                if (metaDataModel[key] !== undefined) fieldsToSet[prefix + key] = castEbayField(key, metaDataModel[key]);
            }
        }

        // Backfill the write-once original date for older records, using the best available listing timestamp.
        const originalListedAtCandidate = metaDataModel.originalListedAt
            ?? metaDataModel.currentListedAt
            ?? metaDataModel.listedTime
            ?? existingRecord?.listing?.listedTime
            ?? existingRecord?.listedTime;

        if (existingRecord && existingRecord.originalListedAt == null && originalListedAtCandidate != null) {
            await items.updateOne(
                {
                    itemId,
                    userId,
                    $or: [{ originalListedAt: null }, { originalListedAt: { $exists: false } }]
                },
                { $set: { originalListedAt: castEbayField('originalListedAt', originalListedAtCandidate) } }
            );
        }

        const insertDefaults: Record<string, unknown> = { createdAt: new Date(), ...metadataDefaults };
        for (const key of Object.keys(fieldsToSet)) delete insertDefaults[key];
        if (originalListedAtCandidate != null) {
            insertDefaults.originalListedAt = castEbayField('originalListedAt', originalListedAtCandidate);
        }
        const result = await items.findOneAndUpdate(
            { itemId, userId },
            {
                $set: fieldsToSet,
                $setOnInsert: insertDefaults
            },
            { returnDocument: 'after', upsert }
        );

        if (!result) {
            // if upsert was false and no doc matched, treat as not found / bad request
            return upsert ? StatusCodes.InsertFailed : StatusCodes.BadRequest;
        }

        return StatusCodes.OK;

    } catch (error) {
        console.error(`Error updating eBay metadata for itemId:${itemId} userId:${userId}`, error);
        return StatusCodes.InsertFailed;
    }
}

export async function updateRelistSettings(userId: string, itemId: string, relistData: Partial<MetaDataModel>) : Promise<StatusCodes>
{
    if (relistData.relistAt != null && Number.isNaN(new Date(relistData.relistAt).getTime())) {
        return StatusCodes.BadRequest;
    }

    const settings: Partial<MetaDataModel> = { ...relistData };
    if (relistData.relistEnabled === false) {
        settings.relistAt = null;
    }

    return updateEbayMetadata(userId, itemId, settings, true);
}

export async function markRelistSuccess(
    userId: string,
    itemId: string,
    result: { listedAt?: Date } = {}
): Promise<StatusCodes> {
    const listedAt = result.listedAt ?? new Date();

    return updateEbayMetadata(userId, itemId, {
        currentListedAt: listedAt,
        lastRelistAttemptAt: listedAt,
        lastRelistResult: 'success',
        relistAttemptCount: 0,
        relistAt: getRelistAt(listedAt, listedAt)
    });
}

export async function markRelistFailure(userId: string, itemId: string, reason: string): Promise<StatusCodes> {
    await connectToDatabase();
    if (!cachedDb) {
        return StatusCodes.NoDatabaseConnection;
    }

    try {
        const result = await EbayItemMetadata.updateOne(
            { itemId, userId },
            {
                $set: { lastRelistAttemptAt: new Date(), lastRelistResult: reason },
                $inc: { relistAttemptCount: 1 }
            }
        ).exec();
        return result.matchedCount ? StatusCodes.OK : StatusCodes.NotFound;
    } catch (error) {
        console.error(`Error recording relist failure for itemId:${itemId} userId:${userId}`, error);
        return StatusCodes.InsertFailed;
    }
}

// A relist creates a new eBay listing, so the item id must move in both collections.
export async function replaceEbayItemId(userId: string, oldItemId: string, newItemId: string, startTime?: Date): Promise<StatusCodes>
{
    await connectToDatabase();

    if (!cachedDb) {
        return StatusCodes.NoDatabaseConnection;
    }

    try {
        if (!cachedDb.db) return StatusCodes.NoDatabaseConnection;
        const metadataResult = await cachedDb.db.collection('ebayitemmetadatas').updateOne(
            { userId, itemId: oldItemId },
            {
                $set: {
                    itemId: newItemId,
                    ...(startTime ? { currentListedAt: startTime, 'listing.listedTime': startTime } : {})
                }
            }
        );

        await cachedDb.db.collection('ebayactiveitems').updateOne(
            { userId, itemId: oldItemId },
            { $set: { itemId: newItemId, ...(startTime ? { StartTime: startTime } : {}) } }
        );

        console.log(`replaceEbayItemId: ${oldItemId} -> ${newItemId} user ${userId}, metadata matched=${metadataResult.matchedCount}`);
        return StatusCodes.OK;
    } catch (error) {
        console.error(`Error replacing eBay itemId ${oldItemId} -> ${newItemId} for user ${userId}`, error);
        return StatusCodes.InsertFailed;
    }
}

export type DueRelistGroup = { userId: string; items: Array<{ itemId: string; metadata: MetaDataModel }> };

// Returns up to `userLimit` users (oldest overdue first), each with up to `itemsPerUser` due items.
export async function getDueRelistGroupsByUser(
    now: Date,
    userLimit: number,
    itemsPerUser: number,
    excludeUserIds: string[] = []
): Promise<{ ok: true; data: DueRelistGroup[] } | { ok: false; code: StatusCodes }>
{
    console.log(`getDueRelistGroupsByUser: ENTER with now=${now.toISOString()}`);
    await connectToDatabase();

    if (!cachedDb) {
        console.error('getDueRelistGroupsByUser: No database connection');
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    // Filter enabled overdue listings, order them by due time, group by user, then cap both batch dimensions.
    const groups = await EbayItemMetadata.aggregate<{ _id: string; items: Array<Record<string, any>> }>([
        {
            $match: {
                relistEnabled: true,
                relistAt: { $ne: null, $lte: now },
                ...(excludeUserIds.length ? { userId: { $nin: excludeUserIds } } : {})
            }
        },
        { $sort: { relistAt: 1 } },
        { $group: { _id: '$userId', oldest: { $min: '$relistAt' }, items: { $push: '$$ROOT' } } },
        { $sort: { oldest: 1 } },
        { $limit: userLimit },
        { $project: { items: { $slice: ['$items', itemsPerUser] } } }
    ]).exec();

    console.log(`getDueRelistGroupsByUser: fetched ${groups.length} user group(s)`);

    return {
        ok: true,
        data: groups.map((group) => ({
            userId: group._id,
            items: group.items.map((item) => ({
                itemId: item.itemId,
                metadata: {
                    relistEnabled: item.relistEnabled,
                    relistAt: item.relistAt,
                    originalListedAt: item.originalListedAt,
                    currentListedAt: item.currentListedAt,
                    lastRelistAttemptAt: item.lastRelistAttemptAt,
                    lastRelistResult: item.lastRelistResult,
                    relistAttemptCount: item.relistAttemptCount ?? undefined,
                    relistDiscountEnabled: item.relistDiscountEnabled,
                    relistDiscountPercent: item.relistDiscountPercent,
                    relistDiscountMaxPercent: item.relistDiscountMaxPercent,
                    relistDiscountBasePrice: item.relistDiscountBasePrice,
                    relistDiscountLastPrice: item.relistDiscountLastPrice
                }
            }))
        }))
    };
}

export async function getItemsDueForRelist(now: Date, limit = 50): Promise<{ ok: true; data: Array<{ itemId: string; userId: string; metadata: MetaDataModel }> } | { ok: false; code: StatusCodes }>
{
    console.log(`getItemsDueForRelist: ENTER with now=${now.toISOString()}`);

    await connectToDatabase();

    if (!cachedDb) {
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    const items = await EbayItemMetadata.find({
        relistEnabled: true,
        relistAt: { $ne: null, $lte: now }
    })
    .limit(limit)
    .lean()
    .exec();

    console.log(`getItemsDueForRelist: fetched ${items.length} item(s) due for relist`);

    return {
        ok: true,
        data: items.map((item) => ({
            itemId: item.itemId,
            userId: item.userId,
            metadata: {
                relistEnabled: item.relistEnabled,
                relistAt: item.relistAt,
                originalListedAt: item.originalListedAt,
                currentListedAt: item.currentListedAt,
                lastRelistAttemptAt: item.lastRelistAttemptAt,
                lastRelistResult: item.lastRelistResult,
                relistAttemptCount: item.relistAttemptCount ?? undefined,
                relistDiscountEnabled: item.relistDiscountEnabled,
                relistDiscountPercent: item.relistDiscountPercent,
                relistDiscountMaxPercent: item.relistDiscountMaxPercent,
                relistDiscountBasePrice: item.relistDiscountBasePrice,
                relistDiscountLastPrice: item.relistDiscountLastPrice
            }
        }))
    };
}

export async function updatePoshmarkMetadata(userId: string, itemId: string, metaDataModel: MetaDataModel, upsert = false) : Promise<StatusCodes>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return StatusCodes.NoDatabaseConnection;
    }

    if (!metaDataModel) {
        return StatusCodes.BadRequest;
    }

    try {
        const result = await PoshmarkItemMetadata.findOneAndUpdate(
            { itemId, userId },         // match by _id and userId
            { $set: metaDataModel },    // apply provided metadata fields
            { new: true, upsert }       // return updated doc; optionally create if missing
        ).exec();

        if (!result) {
            // if upsert was false and no doc matched, treat as not found / bad request
            return upsert ? StatusCodes.InsertFailed : StatusCodes.BadRequest;
        }

        return StatusCodes.OK;

    } catch (error) {
        console.error(`Error updating Poshmark metadata for itemId:${itemId} userId:${userId}`, error);
        return StatusCodes.InsertFailed;
    }
}

export type SoldDataModel = {
    lastRetrievedDate?: Date,
}

export async function updateSold(userId: string, lastRetrieved: Date, upsert = false) : Promise<StatusCodes>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return StatusCodes.NoDatabaseConnection;
    }

    if (!lastRetrieved) {
        return StatusCodes.BadRequest;
    }

    try {
        const result = await EbaySold.findOneAndUpdate(
            { userId },                         // match by userId
            { lastRetrievedDate: lastRetrieved },   // apply provided metadata fields
            { new: true, upsert }               // return updated doc; optionally create if missing
        ).exec();

        if (!result) {
            // if upsert was false and no doc matched, treat as not found / bad request
            return upsert ? StatusCodes.InsertFailed : StatusCodes.BadRequest;
        }

        return StatusCodes.OK;

    } catch (error) {
        console.error(`updateSold: Error updating EbaySold for userId:${userId}`, error);
        return StatusCodes.InsertFailed;
    }
}

type SoldResult =
  | { ok: true; data: SoldDataModel }
  | { ok: false; code: StatusCodes };

export async function getSold(userId: string) : Promise<SoldResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    const soldData = await EbaySold.findOne({ userId }).exec();

    if (!soldData) {
        return { ok: false, code: StatusCodes.NotFound };
    }

    return { ok: true, data: {
        lastRetrievedDate: soldData?.lastRetrievedDate || undefined
    }};
}

type MetaDataResult =
  | { ok: true; data: MetaDataModel }
  | { ok: false; code: StatusCodes };

export async function getEbayMetadata(userId: string, itemId: string) : Promise<MetaDataResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    if (!cachedDb.db) return { ok: false, code: StatusCodes.NoDatabaseConnection };
    const metaData = await cachedDb.db.collection('ebayitemmetadatas').findOne({ itemId, userId });

    if (!metaData) {
        return { ok: false, code: StatusCodes.NotFound };
    }

    return { ok: true, data: {
        purchasePrice: metaData?.purchasePrice ?? undefined,
        purchaseDate: metaData?.purchaseDate || undefined,
        purchaseLocation: metaData?.purchaseLocation || undefined,
        storageLocation: metaData?.storageLocation || undefined,
        title: metaData.listing?.title ?? metaData.title ?? undefined,
        pictureURL: metaData.listing?.pictureURL ?? metaData.pictureURL ?? undefined,
        listedTime: metaData.listing?.listedTime ?? metaData.listedTime ?? undefined,
        soldTime: metaData.sold?.soldTime ?? metaData.soldTime ?? undefined,
        soldPrice: metaData.sold?.soldPrice ?? metaData.soldPrice ?? undefined,
        feePrice: metaData.sold?.feePrice ?? metaData.feePrice ?? undefined,
        shippingLabelCost: metaData.sold?.shippingLabelCost ?? metaData.shippingLabelCost ?? undefined,
        addFeeGeneral: metaData.sold?.addFeeGeneral ?? metaData.addFeeGeneral ?? undefined,
        finalShippingCost: metaData.sold?.finalShippingCost ?? metaData.finalShippingCost ?? undefined,
        originalListedAt: metaData?.originalListedAt || undefined,
        currentListedAt: metaData?.currentListedAt || undefined,
        relistEnabled: metaData.relistEnabled === undefined ? false : metaData.relistEnabled ?? undefined,
        relistAt: metaData?.relistAt || undefined,
        relistDiscountEnabled: metaData.relistDiscountEnabled === undefined ? false : metaData.relistDiscountEnabled ?? undefined,
        relistDiscountPercent: metaData.relistDiscountPercent === undefined ? 5 : metaData.relistDiscountPercent ?? undefined,
        relistDiscountMaxPercent: metaData.relistDiscountMaxPercent === undefined ? 20 : metaData.relistDiscountMaxPercent ?? undefined,
        relistDiscountBasePrice: metaData?.relistDiscountBasePrice ?? undefined,
        relistDiscountLastPrice: metaData?.relistDiscountLastPrice ?? undefined
    }};
}

export type MetaDataSummary = {
    itemCount?: number,
    grossSales?: number,
    totalFees?: number,
    totalPurchasePrice?: number,
    finalShippingCost?: number
}

type MetaDataSummaryResult =
  | { ok: true; data: MetaDataSummary }
  | { ok: false; code: StatusCodes };

export async function getEbayMetadataByDate(userId: string, fromDate: Date, toDate: Date) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    const result = await getEbaySoldItemsForReport(userId, fromDate, toDate);
    if (!result.ok) return result;
    const metaData = result.data;

    return {
        ok: true,
        data: {
            itemCount: metaData.length, grossSales: metaData.reduce((acc, item) => acc + (item.soldPrice || 0), 0),
            totalFees: metaData.reduce((acc, item) => acc + (item.feePrice || 0), 0),
            totalPurchasePrice: metaData.reduce((acc, item) => acc + (item.purchasePrice || 0), 0),
            finalShippingCost: metaData.reduce((acc, item) => acc + (item.finalShippingCost || 0), 0)
        }
    };
}

export type EbayReportRow = {
    itemId: string,
    title: string,
    soldTime: Date,
    soldPrice: number,
    purchasePrice?: number,
    feePrice: number,
    addFeeGeneral: number,
    finalShippingCost: number
}

type EbayReportRowsResult =
  | { ok: true; data: EbayReportRow[] }
  | { ok: false; code: StatusCodes };

// Sold items in the range, oldest first; purchasePrice stays undefined when never entered so the report can flag it.
export async function getEbaySoldItemsForReport(userId: string, fromDate: Date, toDate: Date) : Promise<EbayReportRowsResult>
{
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    if (!cachedDb.db) return { ok: false, code: StatusCodes.NoDatabaseConnection };
    const metaData = await cachedDb.db.collection('ebayitemmetadatas').aggregate<EbayReportRow>([
        { $match: { userId } },
        { $addFields: { effectiveSoldTime: { $ifNull: ['$sold.soldTime', '$soldTime'] } } },
        { $match: { effectiveSoldTime: { $gte: fromDate, $lte: toDate } } },
        { $sort: { effectiveSoldTime: 1 } },
        { $project: {
            _id: 0,
            itemId: 1,
            title: { $ifNull: ['$listing.title', { $ifNull: ['$title', ''] }] },
            soldTime: '$effectiveSoldTime',
            soldPrice: { $ifNull: ['$sold.soldPrice', { $ifNull: ['$soldPrice', 0] }] },
            purchasePrice: 1,
            feePrice: { $ifNull: ['$sold.feePrice', { $ifNull: ['$feePrice', 0] }] },
            addFeeGeneral: { $ifNull: ['$sold.addFeeGeneral', { $ifNull: ['$addFeeGeneral', 0] }] },
            finalShippingCost: { $ifNull: ['$sold.finalShippingCost', { $ifNull: ['$finalShippingCost', 0] }] }
        } }
    ]).toArray();

    return {
        ok: true,
        data: metaData
    };
}

export type PoshmarkReportRow = {
    itemId: string,
    title: string,
    soldTime: Date,
    soldPrice: number,
    purchasePrice?: number,
    feePrice: number
}

type PoshmarkReportRowsResult =
  | { ok: true; data: PoshmarkReportRow[] }
  | { ok: false; code: StatusCodes };

export async function getPoshmarkSoldItemsForReport(userId: string, fromDate: Date, toDate: Date) : Promise<PoshmarkReportRowsResult>
{
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    const metaData = await PoshmarkItemMetadata.find({
        userId,
        soldTime: { $gte: fromDate, $lte: toDate }
    }).sort({ soldTime: 1 }).lean().exec();

    return {
        ok: true,
        data: metaData.map(item => ({
            itemId: item.itemId,
            title: item.title ?? '',
            soldTime: item.soldTime as Date,
            soldPrice: item.soldPrice ?? 0,
            purchasePrice: item.purchasePrice ?? undefined,
            feePrice: item.feePrice ?? 0
        }))
    };
}

// Kept separate from EbaySold, which the dashboard uses to decide what to fetch.
export async function getEbayReportSyncedAt(userId: string, period: string): Promise<Date | null> {
    await connectToDatabase();

    if (!cachedDb) {
        return null;
    }

    const doc = await EbayReportSync.findOne({ userId, period }).lean().exec();
    return doc?.syncedAt ?? null;
}

export async function setEbayReportSyncedAt(userId: string, period: string, syncedAt: Date): Promise<StatusCodes> {
    await connectToDatabase();

    if (!cachedDb) {
        return StatusCodes.NoDatabaseConnection;
    }

    try {
        await EbayReportSync.updateOne({ userId, period }, { $set: { syncedAt } }, { upsert: true }).exec();
        return StatusCodes.OK;
    } catch (error) {
        console.error(`Error saving report sync time for userId:${userId} period:${period}`, error);
        return StatusCodes.InsertFailed;
    }
}

export type PoshmarkMetaDataSummary = {
    itemCount?: number,
    totalItemCount?: number,
    items: MetaDataModel[]
}

type PoshmarkMetaDataSummaryResult =
  | { ok: true; data: PoshmarkMetaDataSummary }
  | { ok: false; code: StatusCodes };

export async function getPoshmarkMetadataByPage(userId: string, page: number) : Promise<PoshmarkMetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    // Access the Poshmark metadata for the given page (assuming 20 items per page)
    const pageSize = 20;
    const fromDate = new Date();
    const toDate = new Date();

    // Will only ever go back 90 days since Poshmark only provides data for the last 90 days,
    // so we can just set the fromDate to 90 days ago and ignore the toDate since it will always be "now"
    fromDate.setDate(fromDate.getDate() - 90);

    // Convert to UTC ISO strings
    const utcFrom = fromDate.toISOString();
    const utcTo   = toDate.toISOString();

    // Total count of all
    const totalCount = await PoshmarkItemMetadata.countDocuments({ userId });

    const metaData = await PoshmarkItemMetadata.find({ userId, soldTime: { $exists: true, $ne: null } })
    .sort({ soldTime: -1 }) // optional but recommended for stable pagination
    .setOptions({ rawResult: true }) // <-- CRITICAL
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()
    .exec();

    if (!metaData) {
        return { ok: false, code: StatusCodes.NotFound };
    }

    return { ok: true, data: {
        itemCount: metaData.length,
        totalItemCount: totalCount,
        items: metaData.map(item => ({
            title: item.title || undefined,
            itemId: item.itemId || undefined,
            soldPrice: item.soldPrice || undefined,
            soldTime: item.soldTime || undefined,
            purchasePrice: item.purchasePrice || undefined,
            // purchaseDate: item.purchaseDate || undefined,
            // purchaseLocation: item.purchaseLocation || undefined,
            // storageLocation: item.storageLocation || undefined,
            pictureURL: item.pictureURL || undefined,
            // listedTime: item.listedTime || undefined,
            // soldTime: item.soldTime || undefined,
            // soldPrice: item.soldPrice || undefined,
            // finalShippingCost: item.finalShippingCost || undefined 
            feePrice: item.feePrice || undefined
        }))
    }};
}

export async function getPoshmarkDaysInPastToScrape(userId: string): Promise<{ ok: boolean; code: StatusCodes; days?: number }> {
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    // 1. Check if the collection is empty
    const count = await PoshmarkItemMetadata.countDocuments({ userId });
    if (count === 0) {
        return { ok: true, code: StatusCodes.EmptyTable, days: 90 }; // If empty, we want to scrape the full 90 days of data
    }

    const latestItem = await PoshmarkItemMetadata.findOne(
        { userId, soldTime: { $exists: true, $ne: null } }
    )
    .sort({ createdAt: -1 })
    .setOptions({ rawResult: true }) // <-- CRITICAL
    .lean()
    .exec();

    console.log("Latest item with soldTime:", latestItem);

    if (!latestItem) {
        return { ok: true, code: StatusCodes.EmptyTable, days: 90 };
    }

    // 3. Parse the createdAt date
    const createdAt = new Date(latestItem.createdAt);
    const now = new Date();

    // Normalize both dates to midnight to avoid time-of-day issues
    createdAt.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    // 4. Calculate difference in days
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = now.getTime() - createdAt.getTime();
    const diffDays = Math.floor(diffMs / msPerDay);

    // 5. Clamp to max 90 days
    return { ok: true, code: StatusCodes.OK, days: Math.min(Math.max(diffDays, 0), 90) };
}

export async function getCurrentWeekStats(userId: string, timeZone: string, now = new Date()) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }
    
    // Go through the metadata for the current week
    const range = getDashboardDateRanges(now, timeZone).currentWeek;
    return await getEbayMetadataByDate(userId, range.from, range.to);
}

export async function getPreviousWeekStats(userId: string, timeZone: string, now = new Date()) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    const range = getDashboardDateRanges(now, timeZone).previousWeek;
    return await getEbayMetadataByDate(userId, range.from, range.to);
}

export async function getPreviousMonthStats(userId: string, timeZone: string, now = new Date()) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    const range = getDashboardDateRanges(now, timeZone).previousMonth;
    return await getEbayMetadataByDate(userId, range.from, range.to);
}

export async function getLast6MonthStats(userId: string, timeZone: string, now = new Date()) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    const range = getDashboardDateRanges(now, timeZone).last6Months;
    return await getEbayMetadataByDate(userId, range.from, range.to);
}

