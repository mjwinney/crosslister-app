import { getTokensFromEbayResponse } from '$lib/server/ebayUtils.js';

export async function GET({ locals, url }) {
    console.log(`eBay Auth Success Callback: ${url}`);

    const result = await getTokensFromEbayResponse(locals, url);

    if (result.status === 'success') {
        // Handle successful token retrieval
        console.log('eBay tokens retrieved successfully:', result.data);
    } else {
        // Handle error
        console.error('Error retrieving eBay tokens:', result.message);
    }
    return new Response(null, { status: 302, headers: { Location: '/' } });
    // return new Response(null, { status: 302, headers: { Location: '/settings' } });
}