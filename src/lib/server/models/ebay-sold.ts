// src/lib/server/models/ebay-sold.ts
import mongoose from 'mongoose';

const EbaySoldSchema = new mongoose.Schema({
    _id: { type: String, required: true },  // Use eBay's item ID as the document ID
    lastRetrieved: { type: Date, required: true },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

export const EbaySold = mongoose.model('EbaySold', EbaySoldSchema);
