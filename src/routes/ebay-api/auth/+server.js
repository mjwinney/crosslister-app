import { authenticateEbayUser } from '$lib/server/ebayUtils';

// Example: Retrieve listed items from eBay API
export async function GET() {
    console.log('Starting eBay user authentication process...');

    // Call the function to authenticate the user
    const response = await authenticateEbayUser();

    const headers = {
        'Content-Type': 'application/json',
        'Content-language': 'en-US',
    };

    if (response.status === 'error') {
        return new Response(response.message, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
    // if (!response.ok) {
    //     return new Response(html, {
    //         status: response.status,
    //         headers: { 'Content-Type': 'text/html' }
    //     });            
    //         // const errorText = await response.text();
    //         // return new Response(`eBay API error: ${response.status} - ${errorText}`, { status: response.status });
    // }

    // // Redirect the client to the eBay authorization endpoint
    // return new Response(null, {
    //     status: 302,
    //     headers: {
    //         Location: encodeURIComponent(response.data),
    //         // 'Content-Type': 'text/html',
    //         // charset: 'utf-8'
    //     }
    // });        

    // Redirect the client to the eBay authorization endpoint
    return new Response(null, {
        status: 302,
        headers: {
            Location: response.data
        }
    });        
}