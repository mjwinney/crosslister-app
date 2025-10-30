// import { json } from '@sveltejs/kit';
// import { env } from '$env/dynamic/private';
import { updateEbayMetadata, type MetaDataModel } from '$lib/server/DatabaseUtils';
import { getMyEbaySellingActive } from '$lib/server/ebayUtils';
// import puppeteer from 'puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js';
import type { PageServerLoad } from './$types';
// src/routes/your-page/+page.server.ts
import type { Actions } from './$types';
// import puppeteer from 'puppeteer';

export const load: PageServerLoad = async ({ locals }) => {

    const response = await getMyEbaySellingActive(locals);
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
    updateItem: async ({ request }) => {
        console.log('updateItem: ENTER');
        console.log('updateItem: request:', request);
        const formData = await request.formData();
        console.log('updateItem: request JSON:', JSON.stringify(formData));
        const itemId = formData.get('itemId') as string;
        const metaData: MetaDataModel = JSON.parse(formData.get('metaData') as string);

        // const metaData = formData.get('metaData') as MetaDataModel;
        const response = await updateEbayMetadata(itemId, metaData);

        // if (response.status !== 200 || !('data' in response)) {
        //     return new Response('Failed to retrieve eBay inventory items', {
        //         status: 500,
        //         headers: { 'Content-Type': 'text/html' }
        //     });
        // }

        console.log('eBay API request successful, response.data:', JSON.stringify(response.data));

        console.log('eBay API request successful, returning data...');
        return {
            post: response.data,
        };

        // Perform server-side logic here
        return { success: true, message: 'Operation complete!' };
    }
};
