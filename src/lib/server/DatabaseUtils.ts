// src/lib/server/DatabaseUtils.ts
import mongoose, { now } from 'mongoose';
import { MONGODB_URI } from '$env/static/private'; // Assuming you've set up environment variables in SvelteKit
import { EbayToken } from './models/ebay-token';
import { EbayActiveItems } from './models/ebay-active-items';
import { EbayItemMetadata } from './models/ebay-item-metadata';
import { EbaySoldItems } from './models/ebay-sold-items';
import { EbaySold } from './models/ebay-sold';
import { getEndOfMonthUTC, getEndOfWeekUTC, getStartOfMonthUTC, getStartOfWeekUTC } from './dateUtils';

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
    NotFound
}

export async function updateEbayToken(userId: string, accessToken: string, refreshToken: string, expiresIn: number): Promise<StatusCodes> {
    console.log(`updateEbayToken called with userId=${userId}, accessToken=${accessToken}, refreshToken=${refreshToken}, expiresIn=${expiresIn}`);

    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return StatusCodes.NoDatabaseConnection;
    }

    try {
        // Calculate the future expiration timestamp
        // Add seconds to the 'now' date
        const now = new Date();
        const expiresAt = now.setSeconds(now.getSeconds() + expiresIn);

        // Use upsert to update the token if it exists or create a new entry if it doesn't
        await EbayToken.updateOne({ userId }, {
            accessToken,
            refreshToken,
            expiresAt
        },
        { upsert: true } // Create a new document if one doesn't exist
        );
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

interface ExpiredToken<T> {
    status: 'expired';
    data: T;
}

interface EbayInfo {
    accessToken: string;
    refreshToken: string;
}

// Combine them into a discriminated union
type Result<T> = Success<T> | Failure | ExpiredToken<T>;

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

        // Check if the token is expired or about to expire (e.g., within the next 5 minutes)
        const now = new Date();
        const bufferTime = 5 * 60 * 1000;
        if (ebayData.expiresAt.getTime() < now.getTime() + bufferTime) {
            return { status: 'expired', data: { accessToken: ebayData.accessToken, refreshToken: ebayData.refreshToken } };
        }

        return { status: 'success', data: { accessToken: ebayData.accessToken, refreshToken: ebayData.refreshToken } };

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
    purchasePrice?: number,
    soldPrice?: number,
    purchaseDate?: string,
    purchaseLocation?: string,
    storageLocation?: string,
    pictureURL?: string,
    listedTime?: Date,
    soldTime?: Date,
    feePrice?: number
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
        const result = await EbayItemMetadata.findOneAndUpdate(
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
        console.error(`Error updating eBay metadata for itemId:${itemId} userId:${userId}`, error);
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
        soldTime: metaData?.soldTime || undefined
    }};
}

export type MetaDataSummary = {
    itemCount?: number,
    grossSales?: number,
    totalFees?: number,
    totalPurchasePrice?: number,
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
            totalPurchasePrice: metaData.reduce((acc, item) => acc + (item.purchasePrice || 0), 0)
        }
    };
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
    const now = new Date();
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