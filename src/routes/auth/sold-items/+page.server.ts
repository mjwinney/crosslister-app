import { StatusCodes, updateEbayMetadata, type MetaDataModel } from '$lib/server/DatabaseUtils';
import { getMyEbayOrders } from '$lib/server/ebayUtils';
import { readMetadataRequest } from '$lib/server/metadataRequest';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ request, locals }) => {

    // Get the page query parameter
    const url = new URL(request.url);
    const pageParam = url.searchParams.get('page');
    const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
    console.log('load: pageNumber:', pageNumber);
    const response = await getMyEbayOrders(locals, pageNumber);

    if (response.status !== 200 || !('data' in response)) {
        return new Response('Failed to retrieve eBay inventory items', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // console.log('page.server.ts: load: eBay API request successful, response.data:', JSON.stringify(response.data));

    // console.log('eBay API request successful, returning data...');
    return {
        post: response.data,
    };
};

export const actions: Actions = {
    updateItem: async ({ request, locals }) => {
        console.log('updateItem: ENTER');
        const formData = await request.formData();

        const parsed = readMetadataRequest<MetaDataModel>(formData, locals);
        if (!parsed.ok) {
            return parsed.failure;
        }
        const { userId, itemId, metaData } = parsed;

        console.log('updateItem: userId:', userId);

        const response = await updateEbayMetadata(userId, itemId, metaData, true);

        if (response !== StatusCodes.OK) {
            return fail(500, { message: 'Failed to update eBay item metadata' });
        }

        console.log('eBay API request successful, success');
        return { success: true, message: 'Operation complete!' };
    },
};
