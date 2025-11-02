import { StatusCodes, updateEbayToken } from '$lib/server/DatabaseUtils';
import { getTokensFromEbayResponse } from '$lib/server/ebayUtils.js';

export async function GET({ locals, url }) {
    console.log(`eBay Auth Success Callback: ${url}`);

    const result = await getTokensFromEbayResponse(locals, url);

    if (result.status !== 'success') {
        return new Response(`Failed to get tokens from eBay: ${result.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    const userId = locals?.session?.userId;

    console.log(`eBay Auth Success Callback userId: ${userId}`);
    console.log(`eBay Auth Success Callback access_token: ${result.data.access_token}`);
    console.log(`eBay Auth Success Callback refresh_token: ${result.data.refresh_token}`);
    console.log(`eBay Auth Success Callback expires_in: ${result.data.expires_in}`);

    // Update eBay token in the database
    const updatedStatus = await updateEbayToken(userId || '', result.data.access_token, result.data.refresh_token, result.data.expires_in);

    if (updatedStatus !== StatusCodes.OK) {
        return new Response('Failed to update eBay token.', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    return new Response(null, { status: 302, headers: { Location: '/auth/dashboard' } });
}