// src/lib/server/models/ebay-report-sync.ts
import mongoose from 'mongoose';

const EbayReportSyncSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    period: { type: String, required: true },
    syncedAt: { type: Date, required: true },
});

// one refresh timestamp per user and report period
EbayReportSyncSchema.index({ userId: 1, period: 1 }, { unique: true });

export const EbayReportSync = mongoose.model('EbayReportSync', EbayReportSyncSchema);
