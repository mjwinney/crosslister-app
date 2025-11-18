// src/lib/server/models/ebay-active-items.ts
import mongoose from 'mongoose';

const EbaySoldItemsSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    StartTime: { type: Date, required: true },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

export const EbaySoldItems = mongoose.model('EbaySoldItems', EbaySoldItemsSchema);
