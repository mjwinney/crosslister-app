import { StatusCodes, updateEbayMetadata, getPoshmarkDaysInPastToScrape, getPoshmarkMetadataByPage } from '$lib/server/DatabaseUtils';
import { updatePoshmarkMetadata, type MetaDataModel } from "$lib/server/DatabaseUtils";
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ request, locals }) => {
    // Get the page query parameter
    const url = new URL(request.url);
    const pageParam = url.searchParams.get('page');
    const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
    const userId = locals?.session?.userId || '';
    console.log('load: pageNumber:', pageNumber);

    // See how many days back we need to go back in the poshmark sold items
    // by looking at the poshmark database and finding the most recent sold item
    // and calculating how many days back we need to go to get new items.
    // This is then passed to the page to get the new items.
    const daysToGoBack = await getPoshmarkDaysInPastToScrape(userId);
    console.log('load: daysToGoBack:', daysToGoBack);

    const response = await getPoshmarkMetadataByPage(userId, pageNumber);

    // if (!('data' in response)) {
    //     return new Response('Failed to retrieve Poshmark metadata items', {
    //         status: 500,
    //         headers: { 'Content-Type': 'text/html' }
    //     });
    // }

    console.log('Poshmark metadata API request successful, response.data:', JSON.stringify(response));

    // const response = { data: [] };
    // console.log('Poshmark metadata API request successful, returning data...');

    return {
        post: { daysToGoBack: daysToGoBack.days, data: response.data }
    };
};


// export const load: PageServerLoad = async ({ request, locals }) => {

    // Get the page query parameter
    // const url = new URL(request.url);
    // const pageParam = url.searchParams.get('page');
    // const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
    // console.log('load: pageNumber:', pageNumber);
    // const response = await getMyEbayOrders(locals, pageNumber);

    // if (response.status !== 200 || !('data' in response)) {
    //     return new Response('Failed to retrieve eBay inventory items', {
    //         status: 500,
    //         headers: { 'Content-Type': 'text/html' }
    //     });
    // }

    // // console.log('page.server.ts: load: eBay API request successful, response.data:', JSON.stringify(response.data));

    // // console.log('eBay API request successful, returning data...');
    // return {
    //     post: response.data,
    // };
// };

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

        console.log('eBay API request successful, success');
        return { success: true, message: 'Operation complete!' };
    },
    // savePoshmarkSoldItems: async ({ request, locals }) => {
    //     console.log('savePoshmarkSoldItems: ENTER');
    //     const formData = await request.formData();
    //     // console.log('savePoshmarkSoldItems: request JSON:', JSON.stringify(formData));
    //     const data = formData.get('data') as string;
    //     // console.log('savePoshmarkSoldItems: data:', data);
    //     const items = JSON.parse(data);

    //     // loop through all the data returned from the Poshmark API and save it to the database
    //     for (const item of items) {
    //         // console.log(`savePoshmarkSoldItems: item:${JSON.stringify(item)}`);
    //     //     const userId = item.userId;
    //         const itemId = item.id;
    //         const userId = locals?.session?.userId || '';


    //         console.log(`savePoshmarkSoldItems: itemId:${itemId}, userId:${userId}`);
    //         const diff = (item.total_price_amount?.val ?? 0) - (item.total_earnings_amount?.val ?? 0);
    //         const feeAmount = Number(diff.toFixed(2));

    //         const metaData: MetaDataModel = {
    //             title: item.title,
    //             pictureURL: item.picture_url,
    //             soldTime: item.inventory_booked_at,
    //             soldPrice: item.total_price_amount?.val,
    //             feePrice: feeAmount
    //         };

    //         console.log(`savePoshmarkSoldItems: metaData:${JSON.stringify(metaData)}`);

    //         // Now save the userid, itemid and title to the database
    //         const response = await updatePoshmarkMetadata(userId, itemId, metaData, true);
    //     }

    //     console.log('save Poshmark sold items successful, success');
    //     // return { data: items, success: true, message: 'Operation complete!' };
    //     return new Response(
	// 		JSON.stringify({
	// 			ok: true,
	// 			count: items.length,
	// 			items: items
	// 		}),
	// 		{
	// 			headers: { 'Content-Type': 'application/json' }
	// 		}
	// 	);

    // }
};
