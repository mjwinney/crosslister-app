import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function GET({ url }) {
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

        // Return token response
        return json(data);
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}