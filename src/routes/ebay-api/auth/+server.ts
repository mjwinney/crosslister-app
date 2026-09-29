import { redirect } from '@sveltejs/kit';
import { buildEbayAuthURL } from '$lib/server/ebayUtils';
import type { RequestHandler } from './$types';

const allowedReturnPaths = new Set([
    '/auth/active-items',
    '/auth/sold-items',
    '/auth/unsold-items',
    '/auth/dashboard'
]);

export const GET: RequestHandler = async ({ cookies, url }) => {
    console.log('eBay auth route: Initiating eBay authorization flow');

    const requestedReturnTo = url.searchParams.get('returnTo') ?? '';
    const returnUrl = new URL(requestedReturnTo, url.origin);
    const returnTo = returnUrl.origin === url.origin && allowedReturnPaths.has(returnUrl.pathname)
        ? `${returnUrl.pathname}${returnUrl.search}`
        : '/auth/dashboard';
    const state = crypto.randomUUID();
    const cookieOptions = {
        httpOnly: true,
        secure: url.protocol === 'https:',
        sameSite: 'lax' as const,
        path: '/auth/ebay-auth-success-callback',
        maxAge: 600
    };

    cookies.set('ebay_oauth_state', state, cookieOptions);
    cookies.set('ebay_oauth_return_to', returnTo, cookieOptions);
    
    const result = await buildEbayAuthURL(state);
    
    if (result.status === 'success') {
        console.log('eBay auth route: Redirecting to', result.data);
        throw redirect(302, result.data);
    } else {
        console.error('eBay auth route: Failed to build auth URL:', result.message);
        throw redirect(302, '/auth/dashboard');
    }
};
