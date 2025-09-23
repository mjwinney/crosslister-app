import { json } from '@sveltejs/kit';
// If EBAY_USER_TOKEN is defined in your .env file, use the dynamic import:
import { env } from '$env/dynamic/private';
import { retrieveAllInventoryItems } from '$lib/server/ebayUtils';

// Example: Retrieve listed items from eBay API
export async function GET({ locals}) {
    console.log('Starting eBay API request to retrieve inventory items...');
    const response = await retrieveAllInventoryItems(locals);
    if (response.status === 'error') {
        return new Response('Failed to retrieve eBay inventory items', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    console.log('eBay API request successful, returning data...');
    return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    // const endpoint = 'https://api.sandbox.ebay.com/sell/inventory/v1/inventory_item'; // Replace with your endpoint
    // const token = env.EBAY_USER_TOKEN;

    // const headers = {
    //     'Authorization': `Bearer ${token}`,
    //     'Content-Type': 'application/json',
    //     'Accept': 'application/json',
    //     'Accept-encoding': 'gzip, deflate, br',
    //     'Connection': 'keep-alive',
    // };

    // // console.log('headers:', JSON.stringify(headers));

    // try {
    //     const response = await fetch(endpoint, {
    //         method: 'GET',
    //         headers: headers,
    //     });

    //     if (!response.ok) {
    //         const errorText = await response.text();
    //         return new Response(`eBay API error: ${response.status} - ${errorText}`, { status: response.status });
    //     }

    //     const data = await response.json();
    //     return new Response(JSON.stringify(data), {
    //         headers: { 'Content-Type': 'application/json' }
    //     });
    // } catch (error) {
    //     console.error('Error making eBay API request:', error);
    //     return new Response('Internal server error', { status: 500 });
    // }
}