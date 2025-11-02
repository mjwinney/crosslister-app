// src/lib/server/models/ebay-token.ts
import mongoose from 'mongoose';

const EbayItemMetadataSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Use eBay's item ID as the document ID
    userId: { type: String, required: true },
    purchasePrice: { type: Number, required: false },
    purchaseDate: { type: Date, required: false },
    purchaseLocation: { type: String, required: false },
    storageLocation: { type: String, required: false },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

export const EbayItemMetadata = mongoose.model('EbayItemMetadata', EbayItemMetadataSchema);
