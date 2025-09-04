// src/lib/server/DatabaseUtils.ts
import mongoose from 'mongoose';
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
    // Ensure the database connection is established
    await connectToDatabase();

    if (!cachedDb) {
        console.log("No database connection available");
        return StatusCodes.NoDatabaseConnection;
    }

    try {
        await EbayToken.updateOne({ userId }, {
            accessToken,
            refreshToken,
            expiresIn
        },
        { upsert: true } // Create a new document if one doesn't exist
        );
        return StatusCodes.OK;
    } catch (error) {
        console.error("Error updating eBay token:", error);
        return StatusCodes.ErrorCreatingUser;
    }
}