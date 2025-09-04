// src/lib/server/models/ebay-token.ts
import mongoose from 'mongoose';

const EbayTokenSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresIn: { type: Number, required: true },
    // Add other relevant fields like creation date, user ID, etc.
    createdAt: { type: Date, default: Date.now },
});

export const EbayToken = mongoose.model('EbayToken', EbayTokenSchema);
