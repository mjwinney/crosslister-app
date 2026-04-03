import mongoose from 'mongoose';

const PoshmarkItemMetadataSchema = new mongoose.Schema({
    itemId: { type: String, required: true },
    userId: { type: String, required: true },
    title: { type: String, required: false },
    purchasePrice: { type: Number, required: false },
    soldPrice: { type: Number, required: false },
    purchaseDate: { type: String, required: false }, // stored as MM/DD/YYYY string
    purchaseLocation: { type: String, required: false },
    storageLocation: { type: String, required: false },
    pictureURL: { type: String, required: false },
    soldTime: { type: Date, required: false }, // stored as iso string
    feePrice: { type: Number, required: false },
    xlistedEbayItemId: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
});

// enforce uniqueness per user+item
PoshmarkItemMetadataSchema.index({ itemId: 1, userId: 1 }, { unique: true });

export const PoshmarkItemMetadata = mongoose.model('PoshmarkItemMetadata', PoshmarkItemMetadataSchema);
