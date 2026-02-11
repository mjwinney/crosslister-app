import { updatePoshmarkMetadata, type MetaDataModel } from "$lib/server/DatabaseUtils";

export const POST = async ({ request, locals }) => {
    console.log('POST: ENTER');
    const data = await request.json();
    // console.log(JSON.stringify(data));
    // console.log(`POST: locals:${JSON.stringify(locals)}`);

    // loop through all the data returned from the Poshmark API and save it to the database
    for (const item of data) {
        // console.log(`POST: item:${JSON.stringify(item)}`);
    //     const userId = item.userId;
        const itemId = item.id;
        const userId = locals?.session?.userId || '';


        console.log(`POST: itemId:${itemId}, userId:${userId}`);
        const diff = (item.total_price_amount?.val ?? 0) - (item.total_earnings_amount?.val ?? 0);
        const feeAmount = Number(diff.toFixed(2));

        const metaData: MetaDataModel = {
            title: item.title,
            pictureURL: item.picture_url,
            soldTime: item.inventory_booked_at,
    //         listedTime: ebayItem.ListingDetails?.StartTime,
            soldPrice: item.total_price_amount?.val,
            feePrice: feeAmount
        };

        console.log(`POST: metaData:${JSON.stringify(metaData)}`);

        // Now save the userid, itemid and title to the database
        const response = await updatePoshmarkMetadata(userId, itemId, metaData, true);
    }

    return new Response(JSON.stringify({ ok: true }));
};
