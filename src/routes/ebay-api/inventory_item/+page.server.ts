// import { json } from '@sveltejs/kit';
// import { env } from '$env/dynamic/private';
import { getMyEbaySelling } from '$lib/server/ebayUtils';
// import puppeteer from 'puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js';
import type { PageServerLoad } from './$types';
// src/routes/your-page/+page.server.ts
import type { Actions } from './$types';
// import puppeteer from 'puppeteer';

export const load: PageServerLoad = async ({ locals }) => {

    const response = await getMyEbaySelling(locals);
    if (response.status !== 200 || !('data' in response)) {
        return new Response('Failed to retrieve eBay inventory items', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    console.log('eBay API request successful, response.data:', JSON.stringify(response.data));

    console.log('eBay API request successful, returning data...');
    return {
        post: response.data,
    };
};

export const actions: Actions = {
    async openBrowser({ request }) {
       console.log('openBrowser: ENTER');
        console.log('Page loaded successfully!');

        // Perform server-side logic here
        return { success: true, message: 'Operation complete!' };
    }
};
