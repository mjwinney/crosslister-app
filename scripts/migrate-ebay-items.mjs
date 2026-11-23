import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { migrateEbayItems } from '../src/lib/server/migrate-ebay-items.mjs';

const userId = process.argv[2];
if (!userId || process.argv.length !== 3 || !process.env.MONGODB_URI) {
	console.error('Usage: node scripts/migrate-ebay-items.mjs <userId> (MONGODB_URI must be set)');
	process.exitCode = 1;
} else {
	const client = new MongoClient(process.env.MONGODB_URI);
	try {
		await client.connect();
		const result = await migrateEbayItems(client.db(), userId);
		console.log('Migration counts:', {
			metadata: result.metadataCount,
			active: result.activeCount,
			sold: result.soldCount,
			skipped: result.issues.length
		});
		if (result.issues.length) {
			for (const issue of result.issues) {
				console.error(`Skipped ${issue.collection} _id=${issue.documentId}${issue.itemId ? ` itemId=${issue.itemId}` : ''}: ${issue.reason}`);
			}
			console.error('Migration incomplete. Review the skipped records and rerun after resolving them.');
			process.exitCode = 1;
		} else if (!result.metadataCount && !result.activeCount && !result.soldCount) {
			console.warn('No eBay item records were found for that user ID.');
		} else {
			console.log('Migration completed.');
		}
	} catch (error) {
		console.error('Migration failed:', error);
		process.exitCode = 1;
	} finally {
		await client.close();
	}
}
