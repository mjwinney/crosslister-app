import { fail, type ActionFailure } from '@sveltejs/kit';

// These identify the record, so a client must never be able to set them through the metadata payload.
const IDENTITY_KEYS = ['itemId', 'userId', '_id', 'createdAt'];

type MetadataRequest<T> =
	| { ok: true; userId: string; itemId: string; metaData: T }
	| { ok: false; failure: ActionFailure<{ message: string }> };

// The owner always comes from the session; a userId sent in the form or metadata is never trusted.
export function readMetadataRequest<T extends object>(formData: FormData, locals: App.Locals): MetadataRequest<T> {
	const userId = locals.session?.userId;
	if (!userId) {
		return { ok: false, failure: fail(401, { message: 'You must be signed in' }) };
	}

	const itemId = String(formData.get('itemId') ?? '').trim();
	const rawMetaData = formData.get('metaData');
	if (!itemId || !rawMetaData) {
		return { ok: false, failure: fail(400, { message: 'itemId and metaData are required' }) };
	}

	let metaData: unknown;
	try {
		metaData = JSON.parse(String(rawMetaData));
	} catch {
		return { ok: false, failure: fail(400, { message: 'metaData must be valid JSON' }) };
	}

	if (metaData === null || typeof metaData !== 'object' || Array.isArray(metaData)) {
		return { ok: false, failure: fail(400, { message: 'metaData must be an object' }) };
	}

	for (const key of IDENTITY_KEYS) {
		delete (metaData as Record<string, unknown>)[key];
	}

	return { ok: true, userId, itemId, metaData: metaData as T };
}
