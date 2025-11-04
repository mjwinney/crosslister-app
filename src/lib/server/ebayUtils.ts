import { json } from "@sveltejs/kit";
import { env } from '$env/dynamic/private';
import { getEbayMetadata, insertSoldEbayItems, StatusCodes, updateActiveEbayItem, updateEbayMetadata, updateEbayToken } from "./DatabaseUtils";
import { XMLParser } from "fast-xml-parser";

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

export async function buildEbayAuthURL(): Promise<Result<string>> {
    console.log('buildEbayAuthURL called');

    const EBAY_CLIENT_ID = env.EBAY_CLIENT_ID;
    const EBAY_RU_NAME = env.EBAY_RU_NAME;
    const headers = {
        'Content-Type': 'application/json',
        'Content-language': 'en-US',
    };

    // TODO implement state param at some point
    const qsParams = new URLSearchParams({
        client_id: EBAY_CLIENT_ID ?? '',
        redirect_uri: EBAY_RU_NAME ?? '',
        response_type: 'code',
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory',
        prompt: 'login' // forces user to login each time for testing purposes
    });

    const endpoint = `${env.EBAY_AUTH_ENDPOINT}oauth2/authorize?${qsParams.toString()}`;

    console.log('endpoint:', JSON.stringify(endpoint));

    // Redirect the client to the eBay authorization endpoint
    return {
        status: 'success',
        data: endpoint
    };
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
        const response = await fetch(env.EBAY_API_ENDPOINT + 'identity/v1/oauth2/token', {
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

        // // Update eBay token in the database
        // const status = await updateEbayToken(userId || '', access_token, refresh_token, expires_in);

        // if (status !== StatusCodes.OK) {
        //     return {
        //         status: 'error',
        //         message: 'Failed to update eBay token.'
        //     };
        // }

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

export async function refreshEbayToken(locals: App.Locals) {
    console.log(`refreshEbayToken called`);
    // Prepare token request
    const clientId = env.EBAY_CLIENT_ID;
    const clientSecret = env.EBAY_CLIENT_SECRET;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: locals.ebayRefreshToken || '',
        scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory'
    });

    console.log(`refreshEbayToken called with refresh_token=${locals.ebayRefreshToken}`);

    try {
        const refreshResponse = await fetch(env.EBAY_API_ENDPOINT + 'identity/v1/oauth2/token', {
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
            const userId = locals?.session?.userId;
            console.log(`refreshEbayToken userId: ${userId}`);
            console.log(`New access token: ${data.access_token}`);
            console.log(`New refresh token: ${data.refresh_token}`);
            console.log(`New expires in: ${data.expires_in}`);

            // Update the token store and database
            updateEbayToken(userId || '', data.access_token, data.refresh_token, data.expires_in);
            // tokenStore.accessToken = data.access_token;
            // tokenStore.expiresAt = Date.now() + data.expires_in * 1000;
        } else {
            // Handle error, e.g., if the refresh token is also expired or revoked
            // In this case, you must re-authenticate the user.
            console.error('Refresh token failed', data);
            // tokenStore = { accessToken: null, refreshToken: null, expiresAt: 0 };
            throw new Error('Could not refresh eBay access token. Re-authentication required.');
        }
    } catch (error) {
        console.error('Error refreshing eBay token:', error);
        throw error;
    }
}

export async function retrieveAllInventoryItems(locals: App.Locals): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`retrieveAllInventoryItems called, using access token: ${locals.ebayAccessToken}`);

    const headers = {
        'Accept-Language': 'en-US',
        'Authorization': `Bearer ${locals.ebayAccessToken}`,
    };

    const qsParams = new URLSearchParams({
        limit: '100',
        offset: '0', // This is for pagination, adjust as needed
    });

    const endpoint = `${env.EBAY_API_ENDPOINT}sell/inventory/v1/inventory_item?${qsParams.toString()}`;

    console.log('retrieveAllInventoryItems endpoint:', JSON.stringify(endpoint));
    console.log('retrieveAllInventoryItems headers:', JSON.stringify(headers));

    // console.log(`retrieveAllInventoryItems called with ebayAccessToken=${locals.ebayAccessToken}`);

    try {
        const refreshResponse = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        const data = await refreshResponse.json();

        if (!refreshResponse.ok) {
            console.log(`data: ${JSON.stringify(data)}`);
            console.log(`refreshResponse.status: ${JSON.stringify(refreshResponse.status)}`);

            return {
                status: refreshResponse.status,
                message: JSON.stringify(data)
            };
        }

        console.log(`retrieveAllInventoryItems Callback data: ${JSON.stringify(data)}`);

        return {
            status: 200,
            data: data
        };
    } catch (error) {
        console.error('Error retrieveAllInventoryItems:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function retrieveAllOffers(locals: App.Locals): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`retrieveAllOffers called, using access token: ${locals.ebayAccessToken}`);

    // Call the retrieveAllInventoryItems to retrieve the SKUs
    const inventoryResponse = await retrieveAllInventoryItems(locals);
    if (inventoryResponse.status != 200) {
        console.log('Failed to retrieve inventory items, cannot proceed to get offers.');
        return inventoryResponse;
    }

    // We have the inventory items, now retrieve the offers
    // For simplicity, let's assume we want to get offers for each SKU
    let skus: string[] = [];
    if ('data' in inventoryResponse && inventoryResponse.status === 200 && 'inventoryItems' in inventoryResponse.data) {
        skus = inventoryResponse.data.inventoryItems.map((item: any) => item.sku);
        console.log(`Retrieved SKUs: ${JSON.stringify(skus)}`);
    } else {
        console.log('No inventory items found or error occurred.');
        return inventoryResponse;
    }

    const headers = {
        'Accept-Language': 'en-US',
        'Authorization': `Bearer ${locals.ebayAccessToken}`,
    };

    let offers: any[] = [];

    for (const sku of skus) {
        console.log(`Processing SKU: ${sku}`);

        const qsParams = new URLSearchParams({ sku: sku });

        const endpoint = `${env.EBAY_API_ENDPOINT + 'sell/inventory/v1/offer'}?${qsParams.toString()}`;

        try {
            const offerResponse = await fetch(endpoint, {
                method: 'GET',
                headers: headers
            });

            const data = await offerResponse.json();

            if (offerResponse.ok) {
                console.log(`data: ${JSON.stringify(data)}`);
                console.log(`refreshResponse.status: ${JSON.stringify(offerResponse.status)}`);

                // add the offer data to an array to return later
                offers.push({
                    sku: sku,
                    data: data.offers[0]
                });
            }
            console.log(`retrieveAllOffers for SKU ${sku} Callback data: ${JSON.stringify(data)}`);
        } catch (error) {
            console.error('Error retrieveAllOffers for SKU:', sku, error);
            return {
                status: 500,
                data: offers
            };
        }
    }

    return {
        status: 200,
        data: offers
    };
}

export async function getMyEbaySellingActive(locals: App.Locals, page: number = 1): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`getMyEbaySellingActive called, using access token: ${locals.ebayAccessToken}, for page: ${page}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
    };

    console.log('getMyEbaySellingActive headers:', JSON.stringify(headers));

    // Now build the XML body for the request
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <ActiveList>
            <Sort>StartTimeDescending</Sort>
            <Pagination>
                <EntriesPerPage>20</EntriesPerPage>
                <PageNumber>${page}</PageNumber>
            </Pagination>
        </ActiveList>
    </GetMyeBaySellingRequest>`;

    console.log('getMyEbaySellingActive xmlBody:', xmlBody);

    try {
        const response = await fetch(env.EBAY_TRADING_API_ENDPOINT, {
            method: 'POST',
            headers: headers,
            body: xmlBody
        });

        const data = await response.text();

        if (response.ok) {
            // Initialize the parser
            const parser = new XMLParser();
            const jsonData = parser.parse(data);
            console.log(`getMyEbaySellingActive data: ${JSON.stringify(jsonData)}`);
            console.log(`getMyEbaySellingActive response.status: ${JSON.stringify(response.status)}`);

            // See if any active items were returned
            if (!jsonData.GetMyeBaySellingResponse?.ActiveList) {
                console.log('No active items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            const userId = locals?.session?.userId || '';

            // Update: Store active items in the database
            for (const item of jsonData.GetMyeBaySellingResponse.ActiveList.ItemArray.Item) {
                const itemId = item.ItemID;
                const startDate = new Date(item.ListingDetails.StartTime);

                const status = await updateActiveEbayItem(userId, itemId, startDate, true);
                if (status !== StatusCodes.OK) {
                    console.error(`Failed to insert active eBay item for itemId:${itemId}`);
                    return {
                        status: 500,
                        data: {}
                    };
                }

                // Gather the metadata for the item and combine it into the returned JSON
                const metadata = await getEbayMetadata(userId, itemId);

                if (metadata === StatusCodes) {
                    // Do nothing here, just a type guard
                }
                else {
                    // Must have gotten metadata back so combine the data into the item
                    item.Metadata = metadata;
                }
            }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            console.log(`getMyEbaySellingActive data: ${JSON.stringify(data)}`);
            console.log(`getMyEbaySellingActive response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbaySellingActive:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function getMyEbaySellingSold(locals: App.Locals): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`getMyEbaySellingSold called, using access token: ${locals.ebayAccessToken}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
    };

    console.log('getMyEbaySellingSold headers:', JSON.stringify(headers));

    // Now build the XML body for the request
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <SoldList>
            <Sort>EndTimeDescending</Sort>
            <Pagination>
                <EntriesPerPage>20</EntriesPerPage>
                <PageNumber>1</PageNumber>
            </Pagination>
        </SoldList>
    </GetMyeBaySellingRequest>`;

    console.log('getMyEbaySellingSold xmlBody:', xmlBody);

    try {
        const response = await fetch(env.EBAY_TRADING_API_ENDPOINT, {
            method: 'POST',
            headers: headers,
            body: xmlBody
        });

        const data = await response.text();

        if (response.ok) {
            // Initialize the parser
            const parser = new XMLParser();
            const jsonData = parser.parse(data);
            console.log(`getMyEbaySellingSold data: ${JSON.stringify(jsonData)}`);
            console.log(`getMyEbaySellingSold response.status: ${JSON.stringify(response.status)}`);

            // Update: Store sold items in the database
            // See if any sold items were returned
            if (!jsonData.GetMyeBaySellingResponse?.SoldList) {
                console.log('No sold items found in the response.');
                return {
                    status: response.status,
                    data: jsonData
                };
            }

            for (const item of jsonData.GetMyeBaySellingResponse.SoldList.ItemArray.Item) {
                const itemId = item.ItemID;
                const startDate = new Date(item.ListingDetails.StartTime);

                const status = await insertSoldEbayItems(itemId, startDate);
                if (status !== StatusCodes.OK) {
                    console.error(`Failed to insert sold eBay item for itemId:${itemId}`);
                    return {
                        status: 500,
                        data: {}
                    };
                }

                // Gather the metadata for the item and combine it into the returned JSON
                const metadata = await getEbayMetadata(itemId);

                if (metadata === StatusCodes) {
                    // Do nothing here, just a type guard
                }
                else {
                    // Must have gotten metadata back so combine the data into the item
                    item.Metadata = metadata;
                }
            }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            console.log(`getMyEbaySellingActive data: ${JSON.stringify(data)}`);
            console.log(`getMyEbaySellingActive response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbaySellingActive:', error);
        return {
            status: 500,
            data: {}
        };
    }
}
