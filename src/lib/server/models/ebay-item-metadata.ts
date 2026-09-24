// src/lib/server/models/ebay-token.ts
import mongoose from 'mongoose';

const EbayItemMetadataSchema = new mongoose.Schema({
    itemId: { type: String, required: true },
    userId: { type: String, required: true },
    purchasePrice: { type: Number, required: false },
    soldPrice: { type: Number, required: false },
    purchaseDate: { type: String, required: false }, // stored as MM/DD/YYYY string
    purchaseLocation: { type: String, required: false },
    storageLocation: { type: String, required: false },
    pictureURL: { type: String, required: false },
    listedTime: { type: Date, required: false }, // stored as iso string
    soldTime: { type: Date, required: false }, // stored as iso string
    feePrice: { type: Number, required: false },
    shippingLabelCost: { type: Number, required: false },
    addFeeGeneral: { type: Number, required: false },
    finalShippingCost: { type: Number, required: false },
    originalListedAt: { type: Date, required: false },
    currentListedAt: { type: Date, required: false },
    relistEnabled: { type: Boolean, default: false },
    relistAt: { type: Date, required: false, default: null },
    relistIntervalDays: { type: Number, required: false, default: 30 },
    lastRelistAttemptAt: { type: Date, required: false },
    lastRelistResult: { type: String, required: false },
    relistAttemptCount: { type: Number, required: false, default: 0 },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

// enforce uniqueness per user+item
EbayItemMetadataSchema.index({ itemId: 1, userId: 1 }, { unique: true });

export const EbayItemMetadata = mongoose.model('EbayItemMetadata', EbayItemMetadataSchema);
