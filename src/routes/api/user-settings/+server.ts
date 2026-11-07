// src/routes/api/user-settings/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/auth';
import { isValidTimezone } from '$lib/timezones';

export const PUT: RequestHandler = async ({ request, locals }) => {
    if (!locals.session?.userId) {
        error(401, 'Not signed in');
    }

    const body = (await request.json().catch(() => null)) as { timezone?: unknown } | null;
    if (!body || !isValidTimezone(body.timezone)) {
        error(400, 'Invalid timezone');
    }

    try {
        await auth.api.updateUser({
            body: { timezone: body.timezone },
            headers: request.headers
        });
    } catch (err) {
        console.error(`Failed to save timezone for userId:${locals.session.userId}:`, err);
        error(500, 'Failed to save settings');
    }

    return json({ timezone: body.timezone });
};
