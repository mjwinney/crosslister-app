// src/lib/server/DatabaseUtils.ts
import mongoose, { now } from 'mongoose';
import { MONGODB_URI } from '$env/static/private'; // Assuming you've set up environment variables in SvelteKit
import { EbayToken } from './models/ebay-token';
import { EbayActiveItems } from './models/ebay-active-items';
import { EbayItemMetadata } from './models/ebay-item-metadata';
import { EbaySoldItems } from './models/ebay-sold-items';
import { EbaySold } from './models/ebay-sold';
import { getEndOfMonthUTC, getEndOfWeekUTC, getNowUTCDate, getStartOfMonthUTC, getStartOfWeekUTC } from './dateUtils';
import { PoshmarkItemMetadata } from './models/poshmark-item-metadata';

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
    console.log(`updateEbayToken called with userId=${userId}, accessToken=${accessToken}, refreshToken=${refreshToken}, expiresIn=${expiresIn}, browseToken=${browseToken}, browseExpiresIn=${browseExpiresIn}, sellerUsername=${sellerUsername}`);

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

        // Check if the refresh token is expired or about to expire (e.g., within the next 5 minutes)
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

export async function updateActiveEbayItem(userId: string, itemId: string, updates: Partial<{ startDate: Date; [key: string]: any }>, upsert = false): Promise<StatusCodes> {
    // Ensure DB connection
    await connectToDatabase();
    if (!cachedDb) return StatusCodes.NoDatabaseConnection;

    try {
        const result = await EbayActiveItems.findOneAndUpdate(
            { itemId, userId },               // filter: match both itemId and userId
            { $set: updates },                // apply updates
            { new: true, upsert }             // return the updated doc; optionally create if missing
        ).exec();

        if (!result) {
            // if upsert was false and no doc matched, treat as insert failure or not found
            return upsert ? StatusCodes.InsertFailed : StatusCodes.BadRequest;
        }

        return StatusCodes.OK;
    } catch (error) {
        console.error(`Error updating active eBay item ${itemId} for user ${userId}:`, error);
        return StatusCodes.InsertFailed;
    }
}

export async function insertSoldEbayItems(itemId: string, startDate: Date) : Promise<StatusCodes>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return StatusCodes.NoDatabaseConnection;
    }

    try {
        await EbaySoldItems.updateOne({ _id: itemId }, {
            startDate
        },
        { upsert: true } // Create a new document if one doesn't exist
        );
        return StatusCodes.OK;

    } catch (error) {
        console.error(`Error inserting sold eBay data for itemId:${itemId}`, error);
        return StatusCodes.InsertFailed;
    }
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
    title?: string,
    originalListedAt?: Date | string | null,
    currentListedAt?: Date | string | null,
    relistEnabled?: boolean,
    relistAt?: Date | string | null,
    relistIntervalDays?: number | null,
    lastRelistAttemptAt?: Date | string | null,
    lastRelistResult?: string | null,
    relistAttemptCount?: number | null,
    relistDiscountEnabled?: boolean,
    relistDiscountPercent?: number | null,
    relistDiscountMaxPercent?: number | null,
    relistDiscountBasePrice?: number | null,
    relistDiscountLastPrice?: number | null
}

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
        const existingRecord = await EbayItemMetadata.findOne({ itemId, userId }).exec();
        const metadataToSet: Partial<MetaDataModel> = { ...metaDataModel };
        delete metadataToSet.originalListedAt;

        const originalListedAtCandidate = metaDataModel.originalListedAt
            ?? metaDataModel.currentListedAt
            ?? metaDataModel.listedTime
            ?? existingRecord?.listedTime;

        if (existingRecord && existingRecord.originalListedAt == null && originalListedAtCandidate != null) {
            await EbayItemMetadata.updateOne(
                {
                    itemId,
                    userId,
                    $or: [{ originalListedAt: null }, { originalListedAt: { $exists: false } }]
                },
                { $set: { originalListedAt: originalListedAtCandidate } }
            ).exec();
        }

        const result = await EbayItemMetadata.findOneAndUpdate(
            { itemId, userId },         // match by _id and userId
            {
                $set: metadataToSet,
                $setOnInsert: {
                    ...(originalListedAtCandidate != null ? { originalListedAt: originalListedAtCandidate } : {})
                }
            },
            { new: true, upsert }       // return updated doc; optionally create if missing
        ).exec();

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
    if (relistData.relistIntervalDays !== undefined) {
        const interval = Number(relistData.relistIntervalDays);
        if (!Number.isInteger(interval) || interval <= 0) {
            return StatusCodes.BadRequest;
        }
    }

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
    result: { listedAt?: Date; intervalDays?: number } = {}
): Promise<StatusCodes> {
    const listedAt = result.listedAt ?? new Date();
    const intervalDays = result.intervalDays ?? 30;
    if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
        return StatusCodes.BadRequest;
    }

    return updateEbayMetadata(userId, itemId, {
        currentListedAt: listedAt,
        lastRelistAttemptAt: listedAt,
        lastRelistResult: 'success',
        relistAttemptCount: 0,
        relistAt: new Date(listedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000),
        relistIntervalDays: intervalDays
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
        const metadataResult = await EbayItemMetadata.updateOne(
            { userId, itemId: oldItemId },
            {
                $set: {
                    itemId: newItemId,
                    ...(startTime ? { currentListedAt: startTime } : {})
                }
            }
        ).exec();

        await EbayActiveItems.updateOne(
            { userId, itemId: oldItemId },
            { $set: { itemId: newItemId, ...(startTime ? { StartTime: startTime } : {}) } }
        ).exec();

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
                    relistIntervalDays: item.relistIntervalDays,
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
                relistIntervalDays: item.relistIntervalDays,
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

    const metaData = await EbayItemMetadata.findOne({ itemId, userId }).exec();

    if (!metaData) {
        return { ok: false, code: StatusCodes.NotFound };
    }

    return { ok: true, data: {
        purchasePrice: metaData?.purchasePrice || undefined,
        purchaseDate: metaData?.purchaseDate || undefined,
        purchaseLocation: metaData?.purchaseLocation || undefined,
        storageLocation: metaData?.storageLocation || undefined,
        pictureURL: metaData?.pictureURL || undefined,
        listedTime: metaData?.listedTime || undefined,
        soldTime: metaData?.soldTime || undefined,
        soldPrice: metaData?.soldPrice || undefined,
        finalShippingCost: metaData?.finalShippingCost || undefined,
        originalListedAt: metaData?.originalListedAt || undefined,
        currentListedAt: metaData?.currentListedAt || undefined,
        relistEnabled: metaData?.relistEnabled ?? undefined,
        relistAt: metaData?.relistAt || undefined,
        relistIntervalDays: metaData?.relistIntervalDays ?? undefined,
        relistDiscountEnabled: metaData?.relistDiscountEnabled ?? undefined,
        relistDiscountPercent: metaData?.relistDiscountPercent ?? undefined,
        relistDiscountMaxPercent: metaData?.relistDiscountMaxPercent ?? undefined,
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

    // Convert to UTC ISO strings
    const utcFrom = fromDate.toISOString();
    const utcTo   = toDate.toISOString();

    const metaData = await EbayItemMetadata.find({
        userId,
        soldTime: {
            $gte: new Date(utcFrom),
            $lte: new Date(utcTo),
        }
    }).lean().exec();

    if (!metaData) {
        return { ok: false, code: StatusCodes.NotFound };
    }

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

export async function getCurrentWeekStats(userId: string) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }
    
    // Go through the metadata for the current week
    const now = getNowUTCDate();
    const startOfWeek = getStartOfWeekUTC(); // Monday at 12:00:01 AM

    console.log(`getCurrentWeekStats: startOfWeek:${startOfWeek} now:${now}`);

    return await getEbayMetadataByDate(userId, startOfWeek, now);
}

export async function getPreviousWeekStats(userId: string) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    // Go back to the previous week
    const startOfWeek = getStartOfWeekUTC(1); // Monday at 12:00:01 AM
    const endOfWeek = getEndOfWeekUTC(1);     // Sunday at 11:59:59 PM

    console.log(`getPreviousWeekStats: startOfWeek:${startOfWeek} endOfWeek:${endOfWeek}`);

    return await getEbayMetadataByDate(userId, startOfWeek, endOfWeek);
}

export async function getPreviousMonthStats(userId: string) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    // Go back to the previous week
    const startOfMonth = getStartOfMonthUTC(1); // 1st day of the previous month
    const endOfMonth = getEndOfMonthUTC(1);     // Last day of the previous month

    console.log(`getPreviousMonthStats: startOfMonth:${startOfMonth} endOfMonth:${endOfMonth}`);
    
    return await getEbayMetadataByDate(userId, startOfMonth, endOfMonth);
}

export async function getLast6MonthStats(userId: string) : Promise<MetaDataSummaryResult>
{
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return { ok: false, code: StatusCodes.NoDatabaseConnection };
    }

    // Go back to the previous week
    const startOfMonth = getStartOfMonthUTC(6); // 1st day of the previous month
    const endOfMonth = getEndOfMonthUTC(1);     // Last day of the previous month

    console.log(`getLast6MonthStats: startOfMonth:${startOfMonth} endOfMonth:${endOfMonth}`);
    
    return await getEbayMetadataByDate(userId, startOfMonth, endOfMonth);
}

