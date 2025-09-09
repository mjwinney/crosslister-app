import { json } from "@sveltejs/kit";
import { env } from '$env/dynamic/private';
import { StatusCodes, updateEbayToken } from "./DatabaseUtils";

interface Success<T> {
    status: 'success';
    data: T;
}

interface Failure {
  status: 'error';
  message: string;
}

interface EbayTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Combine them into a discriminated union
type Result<T> = Success<T> | Failure;

export async function authenticateEbayUser() : Promise<Result<string>> {
    console.log('authenticateEbayUser called');

    const EBAY_CLIENT_ID = env.EBAY_CLIENT_ID;
    const EBAY_RU_NAME = env.EBAY_RU_NAME;
    const EBAY_AUTH_ENDPOINT = env.EBAY_AUTH_ENDPOINT;
    const headers = {
        'Content-Type': 'application/json',
        'Content-language': 'en-US',
    };

    // TODO implement state param at some point
    const qsParams = new URLSearchParams({
        client_id: EBAY_CLIENT_ID ?? '',
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
            return {
                status: 'error',
                message: html
            };
            // const errorText = await response.text();
            // return new Response(`eBay API error: ${response.status} - ${errorText}`, { status: response.status });
        }

        // Redirect the client to the eBay authorization endpoint
        return {
            status: 'success',
            data: endpoint
        };

        // return new Response(html, {
        //     headers: { 'Content-Type': 'text/html' }
        // });
    } catch (error) {
        console.error('Error making eBay API request:', error);
        return {
            status: 'error',
            message: 'Internal server error'
        };
    }
}

export async function getTokensFromEbayResponse(locals: App.Locals, url: URL): Promise<Result<EbayTokens>> {
    console.log(`eBay Auth Success Callback: ${url}`);
    // If you need to access session data, you can do so here
    const userId = locals?.session?.userId;
    console.log(`eBay Auth Success Callback userId: ${userId}`);

    const code = url.searchParams.get('code');

    if (!code) {
        return {
            status: 'error',
            message: 'Authorization code not found.'
        };
    }

    // Prepare token request
    const tokenEndpoint = env.EBAY_TOKEN_ENDPOINT;
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
            return {
                status: 'error',
                message: data
            };
        }

        console.log(`eBay Auth Success Callback data: ${JSON.stringify(data)}`);

        const { access_token, refresh_token, expires_in } = data;

        console.log(`eBay Auth access_token: ${access_token}`);
        console.log(`eBay Auth refresh_token: ${refresh_token}`);
        console.log(`eBay Auth expires_in: ${expires_in}`);

        // Update eBay token in the database
        const status = await updateEbayToken(userId || '', access_token, refresh_token, expires_in);

        if (status !== StatusCodes.OK) {
            return {
                status: 'error',
                message: 'Failed to update eBay token.'
            };
        }

        // Return token response
        return {
            status: 'success',
            data: { access_token, refresh_token, expires_in }
        };
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        return {
            status: 'error',
            message: 'Internal server error'
        };
    }
}

async function refreshEbayToken(locals: App.Locals) {
    console.log(`refreshEbayToken called`);
    // Prepare token request
    const clientId = env.EBAY_CLIENT_ID;
    const clientSecret = env.EBAY_CLIENT_SECRET;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: locals.ebayRefreshToken || '',
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly'
    });

    try {
        const refreshResponse = await fetch(env.EBAY_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: params.toString()
        });

        const data = await refreshResponse.json();

        if (!refreshResponse.ok) {
            return json({ error: data }, { status: refreshResponse.status });
        }

        console.log(`refreshEbayToken Callback data: ${JSON.stringify(data)}`);

        if (refreshResponse.ok) {
            tokenStore.accessToken = data.access_token;
            tokenStore.expiresAt = Date.now() + data.expires_in * 1000;
        } else {
            // Handle error, e.g., if the refresh token is also expired or revoked
            // In this case, you must re-authenticate the user.
            console.error('Refresh token failed', data);
            tokenStore = { accessToken: null, refreshToken: null, expiresAt: 0 };
            throw new Error('Could not refresh eBay access token. Re-authentication required.');
        }
    }  catch (error) {
        console.error('Error refreshing eBay token:', error);
        throw error;
    }
}
