import { updatePoshmarkMetadata, getPoshmarkMetadataByPage, type MetaDataModel } from "$lib/server/DatabaseUtils";

export const POST = async ({ request, locals }) => {
    console.log('POST: ENTER');
    const form = await request.formData();
    const raw = form.get('data');
    const parsed = JSON.parse(raw as string);

    // console.log(JSON.stringify(parsed));
    // // console.log(`POST: locals:${JSON.stringify(locals)}`);
    const userId = locals?.session?.userId || '';

    // loop through all the data returned from the Poshmark API and save it to the database
    for (const item of parsed) {
        // console.log(`POST: item:${JSON.stringify(item)}`);
    //     const userId = item.userId;
        const itemId = item.id;

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

    return new Response(JSON.stringify({ message: 'Items saved successfully' }), { status: 200 });

    // const poshMarkdata = await getPoshmarkMetadataByPage(userId, 0);

    // console.log(`POST: getPoshmarkMetadataByPage:${JSON.stringify(poshMarkdata)}`);

    // return new Response(JSON.stringify({ ok: true, poshMarkdata }), {
	// 	headers: { 'Content-Type': 'application/json' }
	// });
};
