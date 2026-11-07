// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { resolveTimezone } from '$lib/timezones';

export const load: LayoutServerLoad = async ({ locals }) => {
    return {
        userTimezone: resolveTimezone(locals.user?.timezone)
    };
};
