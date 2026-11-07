import { getCurrentWeekStats, getLast6MonthStats, getPreviousMonthStats, getPreviousWeekStats, getSold, insertSoldEbayItems, StatusCodes, updateEbayToken, updateSold } from '$lib/server/DatabaseUtils';
import { backfillItemTitles, getMyEbayItem, getMyEbayOrdersDates, getUser } from '$lib/server/ebayUtils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ depends, request, locals }) => {

    depends('app:dashboard');

    const userId = locals?.session?.userId;
    if (!userId) {
        return new Response('Failed to retrieve user ID', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // See if we need to get the ebay SellerUsername for the user to display on the dashboard
    if (!locals.ebaySellerUsername) {
        const ebayUsernameResult = await getUser(locals);
        console.log('getUser result:', ebayUsernameResult);
        if (ebayUsernameResult.status === 'success') {
            console.log('Setting ebaySellerUsername in locals:', ebayUsernameResult.data);
            locals.ebaySellerUsername = ebayUsernameResult.data;
            console.log('locals after setting ebaySellerUsername:', locals);
            // Save to database as well for future reference
            await updateEbayToken({
                userId,
                sellerUsername: ebayUsernameResult.data
            });
        }
    }

    // See if we need to gather some more sold
    // items based on the last time they were gathered
    const soldResult = await getSold(userId);

    const toDate = new Date();
    const lastRetrieved = soldResult.ok ? soldResult.data.lastRetrievedDate : undefined;
    // GetOrders rejects CreateTimeFrom older than 90 days
    const earliestAllowed = new Date(toDate.getTime() - (89 * 24 * 60 * 60 * 1000));
    const fromDate = lastRetrieved && lastRetrieved > earliestAllowed ? lastRetrieved : earliestAllowed;

    const ordersResponse = await getMyEbayOrdersDates(locals, toDate, fromDate);

    if (ordersResponse.status !== 200 || !('data' in ordersResponse)) {
        return new Response('Failed to retrieve eBay inventory items', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // Fill blank titles for older sales (GetOrders only reaches back 90 days)
    await backfillItemTitles(locals, userId, new Date(toDate.getTime() - (365 * 24 * 60 * 60 * 1000)), toDate);

    const weekStatsResult = await getCurrentWeekStats(userId);
    const previousWeekStatsResult = await getPreviousWeekStats(userId);
    const previousMonthStatsResult = await getPreviousMonthStats(userId);
    const last6MonthStatsResult = await getLast6MonthStats(userId);

    const emptySummary = {
        itemCount: 0,
        grossSales: 0,
        totalFees: 0,
        totalPurchasePrice: 0,
        finalShippingCost: 0
    };

    const weekStats = weekStatsResult.ok ? weekStatsResult.data : emptySummary;
    const previousWeekStats = previousWeekStatsResult.ok ? previousWeekStatsResult.data : emptySummary;
    const previousMonthStats = previousMonthStatsResult.ok ? previousMonthStatsResult.data : emptySummary;
    const last6MonthStats = last6MonthStatsResult.ok ? last6MonthStatsResult.data : emptySummary;

    // Record when sold items were last retrieved so the next login only fetches newer orders
    const updateSoldResponse = await updateSold(userId, toDate, true);
    if (updateSoldResponse !== StatusCodes.OK) {
        console.error(`Failed to update lastRetrievedDate for userId:${userId} status:${updateSoldResponse}`);
    }

    // const orders = ordersResponse.data.GetOrdersResponse.OrderArray.Order;

    // // Parallelize the calls to getMyEbayItem for each order item as they are slow!
    // // Step 1: Create an array of Promises
    // const itemPromises = orders.map((item: any) => {
    //     const itemId = item.TransactionArray.Transaction.Item.ItemID;
    //     return getMyEbayItem(locals, itemId, ["ListingDetails"]);
    // });

    // // Step 2: Await all promises in parallel
    // const itemResults = await Promise.all(itemPromises);

    // // Step 3: Map results back to orders
    // orders.forEach((item: any, index: number) => {
    //     const itemData = itemResults[index];

    //     if ('data' in itemData && itemData.status === 200 && itemData.data.GetItemResponse?.Item) {
    //         const ebayItem = itemData.data.GetItemResponse.Item;
    //         item.PictureURL = ebayItem.PictureDetails?.PictureURL?.[0];
    //     }
    // });


    // // Insert sold items into the database
    // for (const item of ordersResponse.data.GetOrdersResponse.OrderArray.Order) {
    //     const itemId = item.TransactionArray.Transaction.Item.ItemID;
    //     const listedDate = new Date(item.StartTime);
    //     const soldDate = new Date(item.TransactionArray.Transaction.CreatedDate);
    //     const insertSoldResponse = await insertSoldEbayItems(itemId, listedDate);
    // }

    // console.log('eBay API request successful, response.data:', JSON.stringify(ordersResponse.data));

    // console.log('eBay API request successful, returning data...');
    // return {
    //     post: ordersResponse.data,
    // };
    return {
        post: {
            weekStats: weekStats,
            previousWeekStats: previousWeekStats,
            previousMonthStats: previousMonthStats,
            last6MonthStats: last6MonthStats,
        },
    };
};

// export const actions: Actions = {
//     updateItem: async ({ request }) => {
//         console.log('updateItem: ENTER');
//         console.log('updateItem: request:', request);
//         const formData = await request.formData();
//         console.log('updateItem: request JSON:', JSON.stringify(formData));
//         const itemId = formData.get('itemId') as string;
//         const metaData: MetaDataModel = JSON.parse(formData.get('metaData') as string);
//         const userId = formData.get('userId') as string;

//         console.log('updateItem: userId:', userId);

//         // const metaData = formData.get('metaData') as MetaDataModel;
//         const response = await updateEbayMetadata(userId, itemId, metaData, true);

//         if (response !== StatusCodes.OK) {
//             return new Response('Failed to update eBay item metadata', {
//                 status: 500,
//                 headers: { 'Content-Type': 'text/html' }
//             });
//         }

//         console.log('eBay API request successful, success');
//         return { success: true, message: 'Operation complete!' };
//     },
// };
