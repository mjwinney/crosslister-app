// src/lib/server/DatabaseUtils.ts
import mongoose, { now } from 'mongoose';
import { MONGODB_URI } from '$env/static/private'; // Assuming you've set up environment variables in SvelteKit
import { EbayToken } from './models/ebay-token';

let cachedDb: mongoose.Connection | null = null; // Cache for the database connection

export async function connectToDatabase() {
    if (cachedDb) {
        console.log("Using existing database connection");
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
        console.log("New database connection established");
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
    ErrorCreatingUser
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

interface ExpiredToken {
    status: 'expired';
    message: string;
}

interface EbayInfo {
    accessToken: string;
    refreshToken: string;
}

// Combine them into a discriminated union
type Result<T> = Success<T> | Failure | ExpiredToken;

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
            return { status: 'expired', message: `eBay token for userId:${userId} is expired or about to expire` };
        }

        return { status: 'success', data: { accessToken: ebayData.accessToken, refreshToken: ebayData.refreshToken } };

    } catch (error) {
        console.error(`Error finding eBay data for userId:${userId}`, error);
        return { status: 'error', message: `Thrown Error finding eBay data for userId:${userId}` };
    }
}