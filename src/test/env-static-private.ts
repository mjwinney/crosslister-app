// Unreachable fallback so a test that forgets startTestMongo() can never reach a real database.
export const MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:1/unconfigured-test-db';
