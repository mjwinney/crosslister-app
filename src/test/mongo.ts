import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server: MongoMemoryServer | undefined;

// Must run before DatabaseUtils is imported, because it reads the URI at import time.
export async function startTestMongo(): Promise<void> {
	server = await MongoMemoryServer.create();
	process.env.TEST_MONGODB_URI = server.getUri('relist-tests');
}

export async function clearTestMongo(): Promise<void> {
	// Tests that never touch the database leave mongoose disconnected, and deleteMany would hang waiting to connect.
	if (mongoose.connection.readyState !== 1) return;
	const collections = mongoose.connection.collections;
	await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function stopTestMongo(): Promise<void> {
	await mongoose.disconnect();
	await server?.stop();
	server = undefined;
}
