import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { EbayToken } from '$lib/server/models/ebay-token';
import { connectToDatabase, StatusCodes, updateEbayToken } from '$lib/server/DatabaseUtils.js';

export async function GET({ locals, url }) {
    console.log(`eBay Auth Success Callback: ${url}`);
    // If you need to access session data, you can do so here
    const userId = locals?.session?.userId;
    console.log(`eBay Auth Success Callback userId: ${userId}`);

    const code = url.searchParams.get('code');

    if (!code) {
        return json({ error: 'Authorization code not found.' }, { status: 400 });
    }

    // Prepare token request
    const tokenEndpoint = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
    const clientId = env.EBAY_CLIENT_ID;
    const clientSecret = env.EBAY_CLIENT_SECRET;
    const redirectUri = env.EBAY_RU_NAME;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
    });

    try {
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            return json({ error: data }, { status: response.status });
        }

        console.log(`eBay Auth Success Callback data: ${JSON.stringify(data)}`);

        const { access_token, refresh_token, expires_in } = data;

        console.log(`eBay Auth access_token: ${access_token}`);
        console.log(`eBay Auth refresh_token: ${refresh_token}`);
        console.log(`eBay Auth expires_in: ${expires_in}`);

        // Update eBay token in the database
        const status = await updateEbayToken(userId || '', access_token, refresh_token, expires_in);

        if (status !== StatusCodes.OK) {
            return json({ error: 'Failed to update eBay token.' }, { status: 500 });
        }

        // Return token response
        return json(data);
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}