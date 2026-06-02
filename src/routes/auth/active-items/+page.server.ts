import { StatusCodes, updateEbayMetadata, type MetaDataModel } from '$lib/server/DatabaseUtils';
import { getMyEbaySellingActive, getMyEbaySellingSold, findItemsByKeywords } from '$lib/server/ebayUtils';
import { fail } from '@sveltejs/kit';
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
            return fail(500, { message: "Failed to update eBay item metadata" });
            // return new Response('Failed to update eBay item metadata', {
            //     status: 500,
            //     headers: { 'Content-Type': 'text/html' }
            // });
        }

        console.log('eBay API request successful, success');
        return { success: true, message: 'Operation complete!' };
    },

    searchKeywords: async ({ request, locals }) => {
        console.log('searchKeywords: ENTER');
        const formData = await request.formData();
        const keywords = formData.get('keywords') as string;
        const page = parseInt(formData.get('page') as string) || 1;

        console.log('searchKeywords: keywords:', keywords, 'page:', page);

        const response = await findItemsByKeywords(locals, keywords, page, 'BEST_MATCH');

        if (response.status !== 200) {
            console.log('searchKeywords: search failed');
            return fail(500, { message: "Failed to search eBay items" });
            // return new Response('Failed to search eBay items', {
            //     status: response.status,
            //     headers: { 'Content-Type': 'application/json' }
            // });
        }

        console.log('searchKeywords: search successful');
        return { 
            success: true, 
            // data: response.data,
            // itemCount: response.data?.FindItemsByKeywordsResponse?.searchResult?.item 
            //     ? (Array.isArray(response.data.FindItemsByKeywordsResponse.searchResult.item) 
            //         ? response.data.FindItemsByKeywordsResponse.searchResult.item.length 
            //         : 1)
            //     : 0
        };
    },
};
