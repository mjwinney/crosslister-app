// src/lib/server/models/ebay-sold.ts
import mongoose from 'mongoose';

const EbaySoldSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    lastRetrievedDate: { type: Date, required: true },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

export const EbaySold = mongoose.model('EbaySold', EbaySoldSchema);
