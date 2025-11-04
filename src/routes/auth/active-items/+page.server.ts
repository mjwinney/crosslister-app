import { StatusCodes, updateEbayMetadata, type MetaDataModel } from '$lib/server/DatabaseUtils';
import { getMyEbaySellingActive, getMyEbaySellingSold } from '$lib/server/ebayUtils';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ request, locals }) => {

    // Get the page query parameter
    const url = new URL(request.url);
    const pageParam = url.searchParams.get('page');
    const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
    console.log('load: pageNumber:', pageNumber);
    const response = await getMyEbaySellingActive(locals, pageNumber);

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
        const userId = formData.get('userId') as string;

        console.log('updateItem: userId:', userId);

        // const metaData = formData.get('metaData') as MetaDataModel;
        const response = await updateEbayMetadata(userId, itemId, metaData, true);

        if (response !== StatusCodes.OK) {
            return new Response('Failed to update eBay item metadata', {
                status: 500,
                headers: { 'Content-Type': 'text/html' }
            });
        }

        console.log('eBay API request successful, returning data...');

        return new Response('Operation complete!', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    },
};
