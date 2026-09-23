import { updateEbayMetadata, updatePoshmarkMetadata, type MetaDataModel } from "$lib/server/DatabaseUtils";

/**
 * Receives POSHMARK_LISTING_CREATED data directly from the Chrome extension,
 * bypassing the window event listener / page intermediary.
 *
 * Expected JSON body:
 * {
 *   ebayId:      string,   // eBay ItemID this listing was cross-listed from
 *   poshmarkId:  string,   // Poshmark listing ID
 *   poshmarkUrl: string,   // Full Poshmark listing URL
 *   title?:      string,   // Listing title
 *   price?:      number,  // Listing price
 * }
 */
export const POST = async ({ request, locals }) => {
    console.log('POST: listing-created — ENTER');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ message: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { ebayId, poshmarkId } = body as {
        ebayId: string;
        poshmarkId: string;
    };

    console.log(`Received data: ebayId=${ebayId}, poshmarkId=${poshmarkId}`);

    if (!poshmarkId) {
        return new Response(JSON.stringify({ message: 'poshmarkId is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const userId = locals?.session?.userId;

    if (!userId) {
        console.warn('listing-created: rejected unauthenticated request');
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    console.log(`Processing listing-created: userId=${userId}, poshmarkId=${poshmarkId}, ebayId=${ebayId}`);

    const poshmarkItemMetadata: MetaDataModel = {
        xlistedEbayItemId: ebayId,
    };

    // Use the Poshmark listing ID as the itemId in the database.
    // The ebayId is stored in the page tracking / extension correlation layer,
    // not in this model — if you need to persist the ebayId on the PoshmarkItemMetadata
    // document itself, add an ebayId field to the schema and populate it here.
    console.log(`listing-created: userId=${userId}, poshmarkId=${poshmarkId}, ebayId=${ebayId}`);

    const response = await updatePoshmarkMetadata(userId, poshmarkId, poshmarkItemMetadata, true);

    if (response !== 0 /* StatusCodes.OK */) {
        console.error(`listing-created: failed to save — response=${response}`);
        return new Response(JSON.stringify({ message: 'Failed to save listing metadata' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Now update ebay metadata to link to this poshmark listing, if applicable
    const ebayItemMetadata: MetaDataModel = {
        xlistedPoshmarkItemId: poshmarkId,
    };

    const ebayResponse = await updateEbayMetadata(userId, ebayId, ebayItemMetadata, true);

    if (ebayResponse !== 0 /* StatusCodes.OK */) {
        console.error(`listing-created: failed to save — response=${ebayResponse}`);
        return new Response(JSON.stringify({ message: 'Failed to save listing metadata' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ message: 'Listing created record saved', poshmarkId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};
