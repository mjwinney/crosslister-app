// src/lib/server/models/ebay-token.ts
import mongoose from 'mongoose';

const EbayItemMetadataSchema = new mongoose.Schema({
    itemId: { type: String, required: true },
    userId: { type: String, required: true },
    listing: {
        title: String,
        pictureURL: String,
        listedTime: Date
    },
    sold: {
        soldPrice: Number,
        soldTime: Date,
        feePrice: Number,
        shippingLabelCost: Number,
        addFeeGeneral: Number,
        finalShippingCost: Number
    },
    // Legacy fields are read until each user's records have been migrated.
    title: { type: String, required: false },
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
    lastRelistAttemptAt: { type: Date, required: false },
    lastRelistResult: { type: String, required: false },
    relistAttemptCount: { type: Number, required: false, default: 0 },
    relistDiscountEnabled: { type: Boolean, default: false },
    relistDiscountPercent: { type: Number, required: false, default: 5 },
    relistDiscountMaxPercent: { type: Number, required: false, default: 20 },
    relistDiscountBasePrice: { type: Number, required: false, default: null },
    relistDiscountLastPrice: { type: Number, required: false, default: null },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

// enforce uniqueness per user+item
EbayItemMetadataSchema.index({ itemId: 1, userId: 1 }, { unique: true });
EbayItemMetadataSchema.index({ relistEnabled: 1, relistAt: 1, userId: 1 });

export const EbayItemMetadata = mongoose.model('EbayItemMetadata', EbayItemMetadataSchema);
