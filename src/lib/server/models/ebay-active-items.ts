// src/lib/server/models/ebay-active-items.ts
import mongoose from 'mongoose';

const EbayActiveItemsSchema = new mongoose.Schema({
    itemId: { type: String, required: true },
    userId: { type: String, required: true },
    StartTime: { type: Date, required: true },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

// enforce uniqueness per user+item
EbayActiveItemsSchema.index({ itemId: 1, userId: 1 }, { unique: true });

export const EbayActiveItems = mongoose.model('EbayActiveItems', EbayActiveItemsSchema);
