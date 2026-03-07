import { updatePoshmarkMetadata, getPoshmarkMetadataByPage, type MetaDataModel } from "$lib/server/DatabaseUtils";
import { getMyEbayItem } from "$lib/server/ebayUtils";

export const POST = async ({ request, locals }) => {
    console.log('POST: ENTER');
    const form = await request.formData();
    const itemIdData = form.get('itemId');
    console.log(`itemId=${JSON.stringify(itemIdData)}`);
    const itemId = JSON.parse(itemIdData as string);

    console.log(`POST: itemId=${itemId}`);
    // // console.log(`POST: locals:${JSON.stringify(locals)}`);
    const userId = locals?.session?.userId || '';

    // Call eBay API to get item details for each item in the parsed data
    const itemData = await getMyEbayItem(locals, itemId, ['Description', 'Title', 'PictureDetails']);

    if (!('data' in itemData) || itemData.status !== 200 || !itemData.data.GetItemResponse?.Item) {
        console.error('Failed to fetch item details from eBay API');
        return new Response(JSON.stringify({ message: 'Failed to fetch item details from eBay API' }), { status: 500 });
    }

    const ebayItem = itemData.data.GetItemResponse.Item;
    console.log(`POST: ebayItem=${JSON.stringify(ebayItem)}`);

    // build the response.
    const responseData = {
        title: ebayItem.Title,
        pictureURL: ebayItem.PictureDetails?.PictureURL,
        conditionDescription: ebayItem.ConditionDescription,
        description: ebayItem.Description
    };

    return new Response(JSON.stringify({ message: 'Item details fetched successfully', itemDetails: responseData }), { status: 200 });

    //     console.log(`POST: metaData:${JSON.stringify(metaData)}`);


    // return new Response(JSON.stringify({ message: 'Items saved successfully' }), { status: 200 });

};
