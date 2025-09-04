import fetch from 'node-fetch'; // Ensure you have node-fetch installed
import { json } from '@sveltejs/kit';
// If EBAY_USER_TOKEN is defined in your .env file, use the dynamic import:
// import { env } from '$env/dynamic/private';
import { EBAY_CLIENT_ID, EBAY_RU_NAME, EBAY_AUTH_ENDPOINT } from '$env/static/private';
import { connectToDatabase } from '$lib/server/DatabaseUtils';

// Example: Retrieve listed items from eBay API
export async function GET() {
    const headers = {
        'Content-Type': 'application/json',
        'Content-language': 'en-US',
    };

    // TODO implement state param at some point
    const qsParams = new URLSearchParams({
        client_id: EBAY_CLIENT_ID ?? '',
        // redirect_uri: encodeURIComponent('http://localhost:5173/callback'),
        redirect_uri: EBAY_RU_NAME ?? '',
        response_type: 'code',
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly'
    });

    const endpoint = `${EBAY_AUTH_ENDPOINT}?${qsParams.toString()}`;

    console.log('endpoint:', JSON.stringify(endpoint));

    // return new Response('Authentication successful', { status: 200 });

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        const html = await response.text();

        if (!response.ok) {
            return new Response(html, {
                status: response.status,
                headers: { 'Content-Type': 'text/html' }
            });            
            // const errorText = await response.text();
            // return new Response(`eBay API error: ${response.status} - ${errorText}`, { status: response.status });
        }

        // Redirect the client to the eBay authorization endpoint
        return new Response(null, {
            status: 302,
            headers: {
                Location: endpoint
            }
        });        

        // return new Response(html, {
        //     headers: { 'Content-Type': 'text/html' }
        // });
    } catch (error) {
        console.error('Error making eBay API request:', error);
        return new Response('Internal server error', { status: 500 });
    }
}