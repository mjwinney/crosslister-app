import { redirect } from '@sveltejs/kit';
import { buildEbayAuthURL } from '$lib/server/ebayUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    console.log('eBay auth route: Initiating eBay authorization flow');
    
    const result = await buildEbayAuthURL();
    
    if (result.status === 'success') {
        console.log('eBay auth route: Redirecting to', result.data);
        throw redirect(302, result.data);
    } else {
        console.error('eBay auth route: Failed to build auth URL:', result.message);
        throw redirect(302, '/auth/dashboard');
    }
};
