import { StatusCodes, updateEbayToken } from '$lib/server/DatabaseUtils';
import { getTokensFromEbayResponse, getUser } from '$lib/server/ebayUtils.js';

export async function GET({ locals, url }) {
    console.log(`eBay Auth Success Callback: ${url}`);
    console.log(`eBay Auth Success Callback locals.session:`, locals.session);
    console.log(`eBay Auth Success Callback locals.user:`, locals.user);

    const userId = locals?.session?.userId;
    
    if (!userId) {
        console.error('eBay Auth Success Callback: No userId in session!');
        return new Response('Session lost. Please log in again and try the eBay authorization again.', {
            status: 401,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    const result = await getTokensFromEbayResponse(locals, url);

    if (result.status !== 'success') {
        console.error(`eBay Auth Success Callback: Token fetch failed - ${result.message}`);
        return new Response(`Failed to get tokens from eBay: ${result.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    console.log(`eBay Auth Success Callback userId: ${userId}`);
    console.log(`eBay Auth Success Callback access_token: ${result.data.access_token}`);
    console.log(`eBay Auth Success Callback refresh_token: ${result.data.refresh_token}`);
    console.log(`eBay Auth Success Callback expires_in: ${result.data.expires_in}`);

    // Update eBay token in the database
    const updatedStatus = await updateEbayToken({
        userId,
        accessToken: result.data.access_token,
        refreshToken: result.data.refresh_token,
        expiresIn: result.data.expires_in
    });

    console.log(`eBay Auth Success Callback updateEbayToken status: ${updatedStatus}`);

    if (updatedStatus !== StatusCodes.OK) {
        console.error(`eBay Auth Success Callback: updateEbayToken failed with status ${updatedStatus}`);
        return new Response('Failed to update eBay token.', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    console.log('eBay Auth Success Callback: Token saved successfully, redirecting to /auth/dashboard');
    return new Response(null, { status: 302, headers: { Location: '/auth/dashboard' } });
}