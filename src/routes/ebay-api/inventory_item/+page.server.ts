// import { json } from '@sveltejs/kit';
// import { env } from '$env/dynamic/private';
import { getMyEbaySelling } from '$lib/server/ebayUtils';
// import puppeteer from 'puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js';
import type { PageServerLoad } from './$types';
// src/routes/your-page/+page.server.ts
import type { Actions } from './$types';
import puppeteer from 'puppeteer';

export const load: PageServerLoad = async ({ locals }) => {

    const response = await getMyEbaySelling(locals);
    if (response.status !== 200 || !('data' in response)) {
        return new Response('Failed to retrieve eBay inventory items', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    console.log('eBay API request successful, response.data:', JSON.stringify(response.data));

    console.log('eBay API request successful, returning data...');
    return {
        post: response.data,
    };
};

export const actions: Actions = {
    async openBrowser({ request }) {
       console.log('openBrowser: ENTER');

    const browser = await puppeteer.launch({
        headless: false, // Set to true for headless mode (no UI)
        userDataDir: "C:\\Users\\winneymj\\AppData\\Local\\Google\\Chrome\\User Data", // Path to your Chrome user data directory
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" // Path to your Chrome executable
       });

    //    const browser = await puppeteer.launch({
    //     headless: false, // Set to true for headless mode (no UI)
    //     userDataDir: "C:\\Users\\winneymj\\AppData\\Local\\Google\\Chrome\\User Data\\Default", // Path to your Chrome user data directory
    //     executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" // Path to your Chrome executable
    //    });

        // const browser = await puppeteer.launch({
        //     executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Example path for Windows
        //     headless: false // Set to true for headless mode (no UI)
        // });
        const page = await browser.newPage();
        await page.goto('https://poshmark.com'); // Replace with your desired URL

        console.log('Page loaded successfully!');

        // Perform server-side logic here
        return { success: true, message: 'Operation complete!' };
    }
};

// Example: Retrieve listed items from eBay API
// export async function GET({ locals}) {
//     console.log('Starting eBay API request to retrieve inventory items...');
//     const response = await retrieveAllInventoryItems(locals);
//     if (response.status === 'error') {
//         return new Response('Failed to retrieve eBay inventory items', {
//             status: 500,
//             headers: { 'Content-Type': 'text/html' }
//         });
//     }

//     console.log('eBay API request successful, returning data...');
//     return new Response(JSON.stringify(response), {
//         headers: { 'Content-Type': 'application/json' }
//     });
    
//     // const endpoint = 'https://api.sandbox.ebay.com/sell/inventory/v1/inventory_item'; // Replace with your endpoint
//     // const token = env.EBAY_USER_TOKEN;

//     // const headers = {
//     //     'Authorization': `Bearer ${token}`,
//     //     'Content-Type': 'application/json',
//     //     'Accept': 'application/json',
//     //     'Accept-encoding': 'gzip, deflate, br',
//     //     'Connection': 'keep-alive',
//     // };

//     // // console.log('headers:', JSON.stringify(headers));

//     // try {
//     //     const response = await fetch(endpoint, {
//     //         method: 'GET',
//     //         headers: headers,
//     //     });

//     //     if (!response.ok) {
//     //         const errorText = await response.text();
//     //         return new Response(`eBay API error: ${response.status} - ${errorText}`, { status: response.status });
//     //     }

//     //     const data = await response.json();
//     //     return new Response(JSON.stringify(data), {
//     //         headers: { 'Content-Type': 'application/json' }
//     //     });
//     // } catch (error) {
//     //     console.error('Error making eBay API request:', error);
//     //     return new Response('Internal server error', { status: 500 });
//     // }
// }