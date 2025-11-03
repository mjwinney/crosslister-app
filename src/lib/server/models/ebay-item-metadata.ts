// src/lib/server/models/ebay-token.ts
import mongoose from 'mongoose';

const EbayItemMetadataSchema = new mongoose.Schema({
    itemId: { type: String, required: true },
    userId: { type: String, required: true },
    purchasePrice: { type: Number, required: false },
    purchaseDate: { type: Date, required: false },
    purchaseLocation: { type: String, required: false },
    storageLocation: { type: String, required: false },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

// enforce uniqueness per user+item
EbayItemMetadataSchema.index({ itemId: 1, userId: 1 }, { unique: true });

export const EbayItemMetadata = mongoose.model('EbayItemMetadata', EbayItemMetadataSchema);
