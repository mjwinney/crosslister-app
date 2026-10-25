import { json } from "@sveltejs/kit";
import { env } from '$env/dynamic/private';
import { type MetaDataModel, getEbayMetadata,  StatusCodes, updateActiveEbayItem, updateEbayMetadata, updateEbayToken } from "./DatabaseUtils";
import { XMLParser } from "fast-xml-parser";
import { da } from "date-fns/locale";

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


export function escapeXml(value: any): string {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function xmlNode(name: string, value: any): string {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return '';
    }

    return `<${name}>${escapeXml(value)}</${name}>`;
}

function xmlAmountNode(
    name: string,
    value: any,
    currency = 'USD'
): string {
    if (
        value === undefined ||
        value === null
    ) {
        return '';
    }

    return `<${name} currencyID="${currency}">${value}</${name}>`;
}

// Helper to safely get ItemID whether Transaction is an object or array
function getItemIdFromTransaction(transaction: any): string | null {
    if (!transaction) return null;
    const txns = Array.isArray(transaction) ? transaction : [transaction];
    for (const tx of txns) {
        if (tx?.Item?.ItemID) return tx.Item.ItemID;
    }
    return null;
}

export async function buildEbayAuthURL(state?: string): Promise<Result<string>> {
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

    if (state) {
        qsParams.set('state', state);
    }

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

export async function refreshEbayToken(locals: App.Locals): Promise<boolean> {
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
            console.error('eBay token refresh failed:', JSON.stringify(data));
            return false;
        }

        console.log(`refreshEbayToken Callback data: ${JSON.stringify(data)}`);

        if (refreshResponse.ok) {
            const userId = locals?.session?.userId;
            if (!userId) {
                throw new Error('Missing userId while refreshing eBay token');
            }
            console.log(`refreshEbayToken userId: ${userId}`);
            console.log(`New access token: ${data.access_token}`);
            console.log(`New refresh token: ${data.refresh_token}`);
            console.log(`New expires in: ${data.expires_in}`);

            // Update the token store and database
            await updateEbayToken({
                userId,
                ...(data.access_token ? { accessToken: data.access_token } : {}),
                ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
                ...(data.expires_in ? { expiresIn: Number(data.expires_in) } : {})
            });
            // Use the fresh tokens for the remainder of this request
            if (data.access_token) locals.ebayAccessToken = data.access_token;
            if (data.refresh_token) locals.ebayRefreshToken = data.refresh_token;
            return true;
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

export async function getBrowseApiToken(userId: string): Promise<Result<{ access_token: string; expires_in: number; }>> {
    console.log(`getBrowseApiToken called for userId: ${userId}`);

    const clientId = env.EBAY_CLIENT_ID;
    const clientSecret = env.EBAY_CLIENT_SECRET;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const browseParams = new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope'
    });

    console.log(`Requesting BROWSE API token`);

    try {
        const browseResponse = await fetch(env.EBAY_API_ENDPOINT + 'identity/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: browseParams.toString()
        });

        const browseData = await browseResponse.json();

        if (!browseResponse.ok) {
            console.error("Browse API token request failed:", browseData);
            return {
                status: 'error',
                message: JSON.stringify(browseData)
            };
        }

        console.log(`BROWSE API token retrieved: ${JSON.stringify(browseData)}`);

        // Store token to database
        await updateEbayToken({
            userId,
            browseToken: browseData.access_token,
            browseExpiresIn: browseData.expires_in
        });

        return {
            status: 'success',
            data: {
                access_token: browseData.access_token,
                expires_in: browseData.expires_in
            }
        };
    } catch (error) {
        console.error('Error fetching Browse API token:', error);
        return {
            status: 'error',
            message: `Error fetching Browse API token: ${error}`
        };
    }
}

export async function getTransactions(locals: App.Locals, orderId: string): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    // console.log(`getTransactions called, using access token: ${locals.ebayAccessToken}`);

    const headers = {
        'Accept-Language': 'en-US',
        'Authorization': `Bearer ${locals.ebayAccessToken}`,
    };

    const qsParams = new URLSearchParams({
        filter: `orderId:{${orderId}}`
    });

    const endpoint = `${env.EBAY_APIZ_ENDPOINT}sell/finances/v1/transaction?${qsParams.toString()}`;

    // console.log('getTransactions endpoint:', JSON.stringify(endpoint));
    // console.log('getTransactions headers:', JSON.stringify(headers));

    // console.log(`getTransactions called with ebayAccessToken=${locals.ebayAccessToken}`);

    try {
        const refreshResponse = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        // console.log(`refreshResponse.status: ${JSON.stringify(refreshResponse.status)}`);

        if (!refreshResponse.ok) {
            console.log(`refreshResponse.status: ${JSON.stringify(refreshResponse.status)}`);
            const data = await refreshResponse.json();
            console.log(`data: ${JSON.stringify(data)}`);

            return {
                status: refreshResponse.status,
                message: JSON.stringify(data)
            };
        }

        const data = await refreshResponse.json();

        // console.log(`getTransactions Callback data: ${JSON.stringify(data)}`);

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

// export async function retrieveAllOffers(locals: App.Locals): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
//     console.log(`retrieveAllOffers called, using access token: ${locals.ebayAccessToken}`);

//     // Call the retrieveAllInventoryItems to retrieve the SKUs
//     const inventoryResponse = await retrieveAllInventoryItems(locals);
//     if (inventoryResponse.status != 200) {
//         console.log('Failed to retrieve inventory items, cannot proceed to get offers.');
//         return inventoryResponse;
//     }

//     // We have the inventory items, now retrieve the offers
//     // For simplicity, let's assume we want to get offers for each SKU
//     let skus: string[] = [];
//     if ('data' in inventoryResponse && inventoryResponse.status === 200 && 'inventoryItems' in inventoryResponse.data) {
//         skus = inventoryResponse.data.inventoryItems.map((item: any) => item.sku);
//         console.log(`Retrieved SKUs: ${JSON.stringify(skus)}`);
//     } else {
//         console.log('No inventory items found or error occurred.');
//         return inventoryResponse;
//     }

//     const headers = {
//         'Accept-Language': 'en-US',
//         'Authorization': `Bearer ${locals.ebayAccessToken}`,
//     };

//     let offers: any[] = [];

//     for (const sku of skus) {
//         console.log(`Processing SKU: ${sku}`);

//         const qsParams = new URLSearchParams({ sku: sku });

//         const endpoint = `${env.EBAY_API_ENDPOINT + 'sell/inventory/v1/offer'}?${qsParams.toString()}`;

//         try {
//             const offerResponse = await fetch(endpoint, {
//                 method: 'GET',
//                 headers: headers
//             });

//             const data = await offerResponse.json();

//             if (offerResponse.ok) {
//                 console.log(`data: ${JSON.stringify(data)}`);
//                 console.log(`refreshResponse.status: ${JSON.stringify(offerResponse.status)}`);

//                 // add the offer data to an array to return later
//                 offers.push({
//                     sku: sku,
//                     data: data.offers[0]
//                 });
//             }
//             console.log(`retrieveAllOffers for SKU ${sku} Callback data: ${JSON.stringify(data)}`);
//         } catch (error) {
//             console.error('Error retrieveAllOffers for SKU:', sku, error);
//             return {
//                 status: 500,
//                 data: offers
//             };
//         }
//     }

//     return {
//         status: 200,
//         data: offers
//     };
// }

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

    // console.log('getMyEbaySellingActive xmlBody:', xmlBody);

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
            // console.log(`getMyEbaySellingActive data: ${JSON.stringify(jsonData)}`);
            // console.log(`getMyEbaySellingActive response.status: ${JSON.stringify(response.status)}`);

            // The Trading API returns HTTP 200 even on failure (e.g. expired token)
            const ack = jsonData.GetMyeBaySellingResponse?.Ack;
            if (ack === 'Failure') {
                console.error('getMyEbaySellingActive eBay error:', JSON.stringify(jsonData.GetMyeBaySellingResponse?.Errors));
                return {
                    status: 401,
                    message: JSON.stringify(jsonData.GetMyeBaySellingResponse?.Errors)
                };
            }

            // See if any active items were returned
            if (!jsonData.GetMyeBaySellingResponse?.ActiveList?.ItemArray?.Item) {
                console.log('No active items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            const userId = locals?.session?.userId || '';

            // A single listing is parsed as an object rather than an array
            const activeItems = jsonData.GetMyeBaySellingResponse.ActiveList.ItemArray.Item;
            if (!Array.isArray(activeItems)) {
                jsonData.GetMyeBaySellingResponse.ActiveList.ItemArray.Item = [activeItems];
            }

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

                if (!metadata.ok) {
                    // Create empty metadata object
                    item.Metadata = {};
                }
                else {
                    // Must have gotten metadata back so combine the data into the item
                    item.Metadata = metadata.data;
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

function extractLegacyEbayItemId(item: any): string {
    if (!item) return '';

    const rawValue = item.legacyItemId ?? item.itemId ?? item.itemHref ?? item.itemWebUrl ?? '';
    if (typeof rawValue !== 'string' || rawValue.trim() === '') return '';

    const decoded = decodeURIComponent(rawValue);
    const parts = decoded.split('|').map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
        const maybeId = parts[parts.length - 2];
        if (/^\d+$/.test(maybeId)) return maybeId;
    }

    if (parts.length === 1 && /^\d+$/.test(parts[0])) {
        return parts[0];
    }

    const match = decoded.match(/(\d{8,})/);
    return match ? match[1] : rawValue;
}

export async function findItemsByKeywords(locals: App.Locals, keywords: string, page: number = 1, sortOrder: string = 'newlyListed'): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`findItemsByKeywords called with keywords: ${keywords}, page: ${page}, sortOrder: ${sortOrder}`);

    // Browse API uses offset-based pagination, not page numbers
    // offset = (page - 1) * limit
    const limit = 20;
    const offset = (page - 1) * limit;

    console.log('findItemsByKeywords locals.ebaySellerUsername:', locals.ebaySellerUsername);
    const qsParams = new URLSearchParams({
        q: keywords,
        limit: limit.toString(),
        offset: offset.toString(),
        sort: sortOrder,
        filter: `sellers:{${locals.ebaySellerUsername}},buyingOptions:{AUCTION|FIXED_PRICE}`
    });

    const endpoint = `${env.EBAY_API_ENDPOINT}buy/browse/v1/item_summary/search?${qsParams.toString()}`;

    // Browse API search endpoint requires OAuth Bearer token
    const browseToken = locals.ebayBrowseToken;
    if (!browseToken) {
        console.error('No eBay browse token available for search');
        return {
            status: 401,
            message: 'eBay authentication required'
        };
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${browseToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept': 'application/json',
        'Accept-Language': 'en-US'
    };

    console.log('findItemsByKeywords endpoint:', endpoint);
    console.log('findItemsByKeywords headers:', JSON.stringify(headers));

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        // Get the raw text first to inspect what's being returned
        const textData = await response.text();
        // console.log('findItemsByKeywords raw response status:', response.status);
        // console.log('findItemsByKeywords raw response text:', textData.substring(0, 500));

        if (!response.ok) {
            console.error('findItemsByKeywords error response:', textData);
            return {
                status: response.status,
                message: textData
            };
        }

        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(textData);
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Response text:', textData.substring(0, 1000));
            return {
                status: 500,
                message: `Invalid JSON response from eBay API: ${textData.substring(0, 500)}`
            };
        }

        console.log('findItemsByKeywords parsed data:', JSON.stringify(data, null, 2));

        // Check if any items were returned
        if (!data.itemSummaries || data.itemSummaries.length === 0) {
            console.log('No items found for keywords:', keywords);
            return {
                status: response.status,
                data: {
                    itemSummaries: [],
                    itemCount: 0
                }
            };
        }

        const userId = locals?.session?.userId || '';

        for (const item of data.itemSummaries) {
            const itemId = extractLegacyEbayItemId(item) || item.ItemID || item.itemId || item.legacyItemId || '';
            item.itemId = itemId;
            console.log(`Processing itemId: ${itemId} for keywords: ${keywords}`);
            // const startDate = new Date(item.ListingDetails.StartTime);

            // const status = await updateActiveEbayItem(userId, itemId, startDate, true);
            // if (status !== StatusCodes.OK) {
            //     console.error(`Failed to insert active eBay item for itemId:${itemId}`);
            //     return {
            //         status: 500,
            //         data: {}
            //     };
            // }

            // Gather the metadata for the item and combine it into the returned JSON
            const metadata = await getEbayMetadata(userId, itemId);

            if (!metadata.ok) {
                // Create empty metadata object
                item.Metadata = {};
            }
            else {
                // Must have gotten metadata back so combine the data into the item
                item.Metadata = metadata.data;
            }
        }


        const itemCount = data.itemSummaries.length;
        console.log(`Found ${itemCount} items for keywords: ${keywords}`);

        return {
            status: response.status,
            data: data
        };
    } catch (error) {
        console.error('Error findItemsByKeywords:', error);
        return {
            status: 500,
            message: `Error performing keyword search: ${error}`
        };
    }
}

export async function getMyEbaySellingUnsold(locals: App.Locals, page: number = 1): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    // console.log(`getMyEbaySellingUnsold called, using access token: ${locals.ebayAccessToken}, for page: ${page}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
    };

    // console.log('getMyEbaySellingUnsold headers:', JSON.stringify(headers));

    // Now build the XML body for the request
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <UnsoldList>
            <Include>true</Include>
            <Sort>StartTimeDescending</Sort>
            <Pagination>
                <EntriesPerPage>20</EntriesPerPage>
                <PageNumber>${page}</PageNumber>
            </Pagination>
        </UnsoldList>
    </GetMyeBaySellingRequest>`;

    const options = {
        // ... other options
        isArray: (name: string, jpath: any, isLeafNode: any, isAttribute: any) => {
            // Force 'item' tag to always be an array
            if (name === "Item") {
            return true;
            }
            return false; 
        }
    };

    // console.log('getMyEbaySellingUnsold xmlBody:', xmlBody);

    try {
        const response = await fetch(env.EBAY_TRADING_API_ENDPOINT, {
            method: 'POST',
            headers: headers,
            body: xmlBody
        });

        const data = await response.text();

        if (response.ok) {
            // Initialize the parser
            const parser = new XMLParser(options);
            // console.log(`getMyEbaySellingUnsold XMLdata: ${data}`);
            const jsonData = parser.parse(data);
            // console.log(`getMyEbaySellingUnsold data: ${JSON.stringify(jsonData)}`);
            // console.log(`getMyEbaySellingUnsold response.status: ${JSON.stringify(response.status)}`);

            // See if any unsold items were returned
            if (!jsonData.GetMyeBaySellingResponse?.UnsoldList) {
                console.log('No sold items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            const userId = locals?.session?.userId || '';

            // Update: Store unsold items in the database
            // for (const item of jsonData.GetMyeBaySellingResponse.ActiveList.ItemArray.Item) {
            //     const itemId = item.ItemID;
            //     const startDate = new Date(item.ListingDetails.StartTime);

            //     const status = await updateActiveEbayItem(userId, itemId, startDate, true);
            //     if (status !== StatusCodes.OK) {
            //         console.error(`Failed to insert active eBay item for itemId:${itemId}`);
            //         return {
            //             status: 500,
            //             data: {}
            //         };
            //     }

            //     // Gather the metadata for the item and combine it into the returned JSON
            //     const metadata = await getEbayMetadata(userId, itemId);

            //     if (!metadata.ok) {
            //         // Create empty metadata object
            //         item.Metadata = {};
            //     }
            //     else {
            //         // Must have gotten metadata back so combine the data into the item
            //         item.Metadata = metadata.data;
            //     }
            // }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            console.log(`getMyEbaySellingUnsold data: ${JSON.stringify(data)}`);
            console.log(`getMyEbaySellingUnsold response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbaySellingUnsold:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function getMyEbaySellingScheduled(locals: App.Locals, page: number = 1): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`getMyEbaySellingScheduled called, using access token: ${locals.ebayAccessToken}, for page: ${page}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
    };

    console.log('getMyEbaySellingScheduled headers:', JSON.stringify(headers));

    // Now build the XML body for the request
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <ScheduledList>
            <Sort>StartTimeDescending</Sort>
            <Pagination>
                <EntriesPerPage>20</EntriesPerPage>
                <PageNumber>${page}</PageNumber>
            </Pagination>
        </ScheduledList>
    </GetMyeBaySellingRequest>`;

    console.log('getMyEbaySellingScheduled xmlBody:', xmlBody);

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
            console.log(`getMyEbaySellingScheduled data: ${JSON.stringify(jsonData)}`);
            console.log(`getMyEbaySellingScheduled response.status: ${JSON.stringify(response.status)}`);

            // See if any active items were returned
            if (!jsonData.GetMyeBaySellingResponse?.ScheduledList) {
                console.log('No scheduled items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            const userId = locals?.session?.userId || '';

            // // Update: Store active items in the database
            // for (const item of jsonData.GetMyeBaySellingResponse.ActiveList.ItemArray.Item) {
            //     const itemId = item.ItemID;
            //     const startDate = new Date(item.ListingDetails.StartTime);

            //     const status = await updateActiveEbayItem(userId, itemId, startDate, true);
            //     if (status !== StatusCodes.OK) {
            //         console.error(`Failed to insert active eBay item for itemId:${itemId}`);
            //         return {
            //             status: 500,
            //             data: {}
            //         };
            //     }

            //     // Gather the metadata for the item and combine it into the returned JSON
            //     const metadata = await getEbayMetadata(userId, itemId);

            //     if (metadata === StatusCodes) {
            //         // Do nothing here, just a type guard
            //     }
            //     else {
            //         // Must have gotten metadata back so combine the data into the item
            //         item.Metadata = metadata;
            //     }
            // }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            console.log(`getMyEbaySellingScheduled data: ${JSON.stringify(data)}`);
            console.log(`getMyEbaySellingScheduled response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbaySellingScheduled:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function getMyEbaySellingSold(locals: App.Locals, page: number): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
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
            <DurationInDays>60</DurationInDays>
            <Sort>EndTimeDescending</Sort>
            <Pagination>
                <EntriesPerPage>20</EntriesPerPage>
                <PageNumber>${page}</PageNumber>
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
            // console.log(`getMyEbaySellingSold data: ${JSON.stringify(jsonData)}`);
            // console.log(`getMyEbaySellingSold response.status: ${JSON.stringify(response.status)}`);

            // Update: Store sold items in the database
            // See if any sold items were returned
            if (!jsonData.GetMyeBaySellingResponse?.SoldList) {
                console.log('No sold items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            // for (const item of jsonData.GetMyeBaySellingResponse.SoldList.ItemArray.Item) {
            //     const itemId = item.ItemID;
            //     const startDate = new Date(item.ListingDetails.StartTime);

            //     const status = await insertSoldEbayItems(itemId, startDate);
            //     if (status !== StatusCodes.OK) {
            //         console.error(`Failed to insert sold eBay item for itemId:${itemId}`);
            //         return {
            //             status: 500,
            //             data: {}
            //         };
            //     }

            //     // Gather the metadata for the item and combine it into the returned JSON
            //     const metadata = await getEbayMetadata(itemId);

            //     if (metadata === StatusCodes) {
            //         // Do nothing here, just a type guard
            //     }
            //     else {
            //         // Must have gotten metadata back so combine the data into the item
            //         item.Metadata = metadata;
            //     }
            // }

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

export async function getMyEbayOrders(locals: App.Locals, page: number): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    // console.log(`getMyEbayOrders called, using access token: ${locals.ebayAccessToken}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetOrders',
    };

    // console.log('getMyEbayOrders headers:', JSON.stringify(headers));

    const nowDate = new Date();
    const pastDate = new Date(nowDate.getTime() - (90 * 24 * 60 * 60 * 1000)); // 90 days ago

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <CreateTimeFrom>${pastDate.toISOString()}</CreateTimeFrom>
        <CreateTimeTo>${nowDate.toISOString()}</CreateTimeTo>
        <OrderRole>Seller</OrderRole>
        <OrderStatus>Completed</OrderStatus>
        <SortingOrder>Descending</SortingOrder>
        <Pagination>
            <EntriesPerPage>20</EntriesPerPage>
            <PageNumber>${page}</PageNumber>
        </Pagination>
    </GetOrdersRequest>`;

    // console.log('getMyEbayOrders xmlBody:', xmlBody);

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
            // console.log(`getMyEbayOrders data: ${JSON.stringify(jsonData)}`);
            // console.log(`getMyEbayOrders response.status: ${JSON.stringify(response.status)}`);

            // Update: Store sold items in the database
            // See if any sold items were returned
            if (!jsonData.GetOrdersResponse?.OrderArray) {
                console.log('No orders found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            const orders = jsonData.GetOrdersResponse.OrderArray?.Order;

            // console.log('Orders found:', orders?.length);

            // Parallelize the calls to getMyEbayItem for each order item as they are slow!
            // Step 1: Create an array of Promises
            const itemPromises = orders.map((item: any) => {
                const itemId = getItemIdFromTransaction(item.TransactionArray?.Transaction);
                if (!itemId) {
                    console.error('Invalid order item structure, missing ItemID:', JSON.stringify(item));
                    return Promise.resolve({ status: 500, message: 'Invalid order item structure' });
                }
                return getMyEbayItem(locals, itemId, ["PictureDetails", "ListingDetails"]);
            });

            // Step 2: Await all promises in parallel
            const itemResults = await Promise.all(itemPromises);

            // Step 3: Map results back to orders
            orders.forEach((item: any, index: number) => {
                const itemData = itemResults[index];

                if ('data' in itemData && itemData.status === 200 && itemData.data.GetItemResponse?.Item) {
                    const ebayItem = itemData.data.GetItemResponse.Item;
                    item.PictureURL = ebayItem.PictureDetails?.PictureURL?.[0];
                    item.StartTime = ebayItem.ListingDetails?.StartTime;
                    item.EndTime = ebayItem.ListingDetails?.EndTime;
                }
            });

            // Parallelize the calls to getTransactions for each order item as they are slow!
            // This contains details about the transaction including fees
            // Step 1: Create an array of Promises
            const transactionPromises = orders.map((item: any) => {
                const orderId = item.OrderID;
                return getTransactions(locals, orderId);
            });

            // Step 2: Await all promises in parallel
            const transactionResults = await Promise.all(transactionPromises);

            // Step 3: Map results back to orders
            orders.forEach(async (item: any, index: number) => {
                const itemData = transactionResults[index];

                if ('data' in itemData && itemData.status === 200 && itemData.data?.transactions) {

                    // Find out how much to buy the shipping label for this order
                    const shippingLabel = itemData.data?.transactions.filter((transaction: { transactionType: string; }) => {
                        return transaction.transactionType === "SHIPPING_LABEL";
                    });

                    item.shippingLabelCost = 0;
                    if (shippingLabel.length > 0) {
                        item.shippingLabelCost = shippingLabel[0].amount.value;
                    }

                    // Find put the add free price
                    const nonSaleCharge = itemData.data?.transactions.filter((transaction: any) => {
                        return transaction.transactionType === "NON_SALE_CHARGE" && transaction.feeType === "AD_FEE";
                    });

                    item.addFeeGeneral = 0;
                    if (nonSaleCharge.length > 0) {
                        item.addFeeGeneral = nonSaleCharge[0].amount.value;
                    }

                    // Find the final value fee
                    const finalValueFee = itemData.data?.transactions.filter((transaction: any) => {
                        return transaction.transactionType === "SALE";
                    });

                    item.finalValueFee = 0;
                    if (finalValueFee.length > 0) {
                        item.finalValueFee = finalValueFee[0].totalFeeAmount.value;
                    }
                }
            });

            const userId = locals?.session?.userId || '';

            // Gather the metadata for the item and combine it into the returned JSON
            for (const item of orders) {
                const itemId = getItemIdFromTransaction(item.TransactionArray?.Transaction);
                if (!itemId) continue;
                const metadata = await getEbayMetadata(userId, itemId);

                if (!metadata.ok) {
                    // Create empty metadata object
                    item.Metadata = {};
                }
                else {
                    // Must have gotten metadata back so combine the data into the item
                    item.Metadata = metadata.data;
                }
            };

            // console.log(`getMyEbayOrders data: ${JSON.stringify(jsonData)}`);

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            // console.log(`getMyEbayOrders data: ${JSON.stringify(data)}`);
            // console.log(`getMyEbayOrders response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbayOrders:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function getMyEbayOrdersDates(locals: App.Locals, toDate: Date, fromDate: Date): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    // console.log(`getMyEbayOrdersDates called, using access token: ${locals.ebayAccessToken}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetOrders',
    };

    // #TODO Need to limit the number of orders returned by only retrieving enough
    // sales that have not already been retrieved 

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <CreateTimeFrom>${fromDate.toISOString()}</CreateTimeFrom>
        <CreateTimeTo>${toDate.toISOString()}</CreateTimeTo>
        <OrderRole>Seller</OrderRole>
        <OrderStatus>Completed</OrderStatus>
        <SortingOrder>Descending</SortingOrder>
        <IncludeFinalValueFee>true</IncludeFinalValueFee>
    </GetOrdersRequest>`;

    // console.log('getMyEbayOrdersDates xmlBody:', xmlBody);

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
            // console.log(`getMyEbayOrdersDates data: ${JSON.stringify(jsonData)}`);
            // console.log(`getMyEbayOrdersDates response.status: ${JSON.stringify(response.status)}`);

            // Update: Store sold items in the database
            // See if any sold items were returned
            if (!jsonData.GetOrdersResponse?.OrderArray) {
                console.log('No orders found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            const orders = jsonData.GetOrdersResponse.OrderArray.Order;

            // Normalize Transaction to always be an array, then find the first ItemID
            const getItemId = (transaction: any): string | null => {
                const txns = Array.isArray(transaction) ? transaction : [transaction];
                for (const tx of txns) {
                    if (tx?.Item?.ItemID) return tx.Item.ItemID;
                }
                return null;
            };

            // Parallelize the calls to getMyEbayItem for each order item as they are slow!
            // Step 1: Create an array of Promises
            const itemPromises = orders.map((item: any) => {
                const itemId = item.TransactionArray ? getItemId(item.TransactionArray.Transaction) : null;
                if (!itemId) {
                    console.error('Invalid order item structure, missing TransactionArray.Transaction.Item.ItemID:', JSON.stringify(item));
                    return Promise.resolve({ status: 500, message: 'Invalid order item structure' });
                }
                // console.log(`getMyEbayOrdersDates itemId: ${itemId}`);
                return getMyEbayItem(locals, itemId, ["PictureDetails", "ListingDetails"]);
            });

            // Step 2: Await all promises in parallel
            const itemResults = await Promise.all(itemPromises);

            const userId = locals?.session?.userId || '';

            // Step 3: Map results back to orders
            orders.forEach(async (item: any, index: number) => {
                const itemData = itemResults[index];

                if ('data' in itemData && itemData.status === 200 && itemData.data.GetItemResponse?.Item) {
                    const ebayItem = itemData.data.GetItemResponse.Item;
                    const itemId = item.TransactionArray ? getItemId(item.TransactionArray.Transaction) : null;
                    if (!itemId) return;

                    const txns = item.TransactionArray.Transaction;
                    const txnArr = Array.isArray(txns) ? txns : [txns];
                    const txn = txnArr[0];

                    const metaData: MetaDataModel = {
                        // pictureURL: item.PictureURL,
                        soldTime: ebayItem.ListingDetails?.EndTime,
                        listedTime: ebayItem.ListingDetails?.StartTime,
                        soldPrice: txn?.TransactionPrice,
                        feePrice: txn?.FinalValueFee
                    };

                    // Upsert into the metadata table
                    const result = await updateEbayMetadata(userId, itemId, metaData, true);
                }
            });

            // Parallelize the calls to getTransactions for each order item as they are slow!
            // This contains details about the transaction including fees
            // Step 1: Create an array of Promises
            const transactionPromises = orders.map((item: any) => {
                const orderId = item.OrderID;
                return getTransactions(locals, orderId);
            });

            // Step 2: Await all promises in parallel
            const transactionResults = await Promise.all(transactionPromises);

            // Step 3: Map results back to orders
            orders.forEach(async (item: any, index: number) => {
                const itemData = transactionResults[index];

                if ('data' in itemData && itemData.status === 200 && itemData.data?.transactions) {

                    // Find out how much to buy the shipping label for this order
                    const shippingLabel = itemData.data?.transactions.filter((transaction: { transactionType: string; }) => {
                        return transaction.transactionType === "SHIPPING_LABEL";
                    });

                    let sellerShippingLabelCost: number = 0;
                    if (shippingLabel.length > 0) {
                        sellerShippingLabelCost = shippingLabel[0].amount.value;
                    }

                    // Calculate the final shipping cost
                    let buyerShippingCost = 0;
                    if (item.IsMultiLegShipping) {
                        buyerShippingCost = parseFloat(item.MultiLegShippingDetails.SellerShipmentToLogisticsProvider.ShippingServiceDetails.TotalShippingCost || '0');
                    } else {
                        const txns = item.TransactionArray?.Transaction;
                        const txnArr = Array.isArray(txns) ? txns : [txns];
                        buyerShippingCost = parseFloat(txnArr[0]?.ActualShippingCost || '0');
                    }

                    // Find put the add free price
                    const nonSaleCharge = itemData.data?.transactions.filter((transaction: any) => {
                        return transaction.transactionType === "NON_SALE_CHARGE" && transaction.feeType === "AD_FEE";
                    });

                    let addFeeGeneral: number = 0;
                    if (nonSaleCharge.length > 0) {
                        addFeeGeneral = nonSaleCharge[0].amount.value;
                    }

                    const itemId = getItemIdFromTransaction(item.TransactionArray?.Transaction);
                    if (!itemId) return;

                    const metaData: MetaDataModel = {
                        shippingLabelCost: sellerShippingLabelCost,
                        addFeeGeneral: addFeeGeneral,
                        finalShippingCost: parseFloat((buyerShippingCost - sellerShippingLabelCost).toFixed(2))
                    };

                    // Upsert into the metadata table
                    const result = await updateEbayMetadata(userId, itemId, metaData, true);
                }
            });

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            console.log(`getMyEbayOrdersDates data: ${JSON.stringify(data)}`);
            console.log(`getMyEbayOrdersDates response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbayOrdersDates:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function getMyEbayItem(locals: App.Locals, ItemID: string, OutputSelector: string[]): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    // console.log(`getMyEbayItem called, using access token: ${locals.ebayAccessToken} and ItemID: ${ItemID}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetItem',
    };

    // console.log('getMyEbayItem headers:', JSON.stringify(headers));

    // Construct the OutputSelector string
    let outputSelectorString = '';
    for (let i = 0; i < OutputSelector.length; i++) {
        outputSelectorString += `<OutputSelector>${OutputSelector[i]}</OutputSelector>`;
    }

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <ItemID>${ItemID}</ItemID>
        <IncludeItemSpecifics>true</IncludeItemSpecifics>
        <DetailLevel>ReturnAll</DetailLevel>
        ${outputSelectorString}
    </GetItemRequest>`;

    // console.log('getMyEbayItem xmlBody:', xmlBody);

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
            // console.log(`getMyEbayItem data: ${JSON.stringify(jsonData)}`);
            // console.log(`getMyEbayItem response.status: ${JSON.stringify(response.status)}`);

            // Update: Store sold items in the database
            // See if any sold items were returned
            if (!jsonData.GetItemResponse?.Item) {
                console.log('No items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            // for (const item of jsonData.GetMyeBaySellingResponse.SoldList.ItemArray.Item) {
            //     const itemId = item.ItemID;
            //     const startDate = new Date(item.ListingDetails.StartTime);

            //     const status = await insertSoldEbayItems(itemId, startDate);
            //     if (status !== StatusCodes.OK) {
            //         console.error(`Failed to insert sold eBay item for itemId:${itemId}`);
            //         return {
            //             status: 500,
            //             data: {}
            //         };
            //     }

            //     // Gather the metadata for the item and combine it into the returned JSON
            //     const metadata = await getEbayMetadata(itemId);

            //     if (metadata === StatusCodes) {
            //         // Do nothing here, just a type guard
            //     }
            //     else {
            //         // Must have gotten metadata back so combine the data into the item
            //         item.Metadata = metadata;
            //     }
            // }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            // console.log(`getMyEbayItem data: ${JSON.stringify(data)}`);
            // console.log(`getMyEbayItem response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbayItem:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function getMyEbaySellerList(locals: App.Locals, page: number): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    // console.log(`getMyEbaySellerList called, using access token: ${locals.ebayAccessToken} and ItemID: ${ItemID}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetSellerList',
    };

    // console.log('getMyEbaySellerList headers:', JSON.stringify(headers));

    const nowDate = new Date();
    const pastDate = new Date(nowDate.getTime() - (120 * 24 * 60 * 60 * 1000)); // 120 days ago

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <GranularityLevel>Fine</GranularityLevel>
        <EndTimeFrom>${pastDate.toISOString()}</EndTimeFrom>
        <EndTimeTo>${nowDate.toISOString()}</EndTimeTo>
        <Sort>1</Sort>
        <Pagination>
            <EntriesPerPage>20</EntriesPerPage>
            <PageNumber>${page}</PageNumber>
        </Pagination>
    </GetSellerListRequest>`;

    console.log('getMyEbayItem xmlBody:', xmlBody);

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
                // console.log(`getMyEbayItem data: ${JSON.stringify(jsonData)}`);
                // console.log(`getMyEbayItem response.status: ${JSON.stringify(response.status)}`);

            if (!jsonData.GetSellerListResponse?.ItemArray?.Item) {
                console.log('No items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            // for (const item of jsonData.GetMyeBaySellingResponse.SoldList.ItemArray.Item) {
            //     const itemId = item.ItemID;
            //     const startDate = new Date(item.ListingDetails.StartTime);

            //     const status = await insertSoldEbayItems(itemId, startDate);
            //     if (status !== StatusCodes.OK) {
            //         console.error(`Failed to insert sold eBay item for itemId:${itemId}`);
            //         return {
            //             status: 500,
            //             data: {}
            //         };
            //     }

            //     // Gather the metadata for the item and combine it into the returned JSON
            //     const metadata = await getEbayMetadata(itemId);

            //     if (metadata === StatusCodes) {
            //         // Do nothing here, just a type guard
            //     }
            //     else {
            //         // Must have gotten metadata back so combine the data into the item
            //         item.Metadata = metadata;
            //     }
            // }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            // console.log(`getMyEbayItem data: ${JSON.stringify(data)}`);
            // console.log(`getMyEbayItem response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbayItem:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function getMyEbayOrderTransactions(locals: App.Locals, ItemID: string): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    // console.log(`getMyEbayOrderTransactions called, using access token: ${locals.ebayAccessToken} and ItemID: ${ItemID}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetItemTransactions',
    };

    // console.log('getMyEbayOrderTransactions headers:', JSON.stringify(headers));

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <ItemID>${ItemID}</ItemID>
        <IncludeFinalValueFee>true</IncludeFinalValueFee>
    </GetItemTransactionsRequest>`;
        // <OutputSelector>FinalValueFee</OutputSelector>

    // console.log('getMyEbayOrderTransactions xmlBody:', xmlBody);

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
            console.log(`getMyEbayOrderTransactions data: ${JSON.stringify(jsonData)}`);
            console.log(`getMyEbayOrderTransactions response.status: ${JSON.stringify(response.status)}`);

            if (!jsonData.GetItemTransactionsResponse?.TransactionArray?.Transaction) {
                console.log('No items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            // for (const item of jsonData.GetMyeBaySellingResponse.SoldList.ItemArray.Item) {
            //     const itemId = item.ItemID;
            //     const startDate = new Date(item.ListingDetails.StartTime);

            //     const status = await insertSoldEbayItems(itemId, startDate);
            //     if (status !== StatusCodes.OK) {
            //         console.error(`Failed to insert sold eBay item for itemId:${itemId}`);
            //         return {
            //             status: 500,
            //             data: {}
            //         };
            //     }

            //     // Gather the metadata for the item and combine it into the returned JSON
            //     const metadata = await getEbayMetadata(itemId);

            //     if (metadata === StatusCodes) {
            //         // Do nothing here, just a type guard
            //     }
            //     else {
            //         // Must have gotten metadata back so combine the data into the item
            //         item.Metadata = metadata;
            //     }
            // }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            // console.log(`getMyEbayItem data: ${JSON.stringify(data)}`);
            // console.log(`getMyEbayItem response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error getMyEbayItem:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export function mapGetItemToAddItem(source: any) {
    const item: any = {};

    // Core
    item.Title = source.Title;
    item.Description = source.Description;

    item.AutoPay = source.AutoPay;
    item.BuyerResponsibleForShipping =
        source.BuyerResponsibleForShipping;

    item.ConditionID = source.ConditionID;

    if (source.ConditionDescription) {
        item.ConditionDescription =
            source.ConditionDescription;
    }

    item.Country = source.Country;
    item.Currency = source.Currency;

    item.DispatchTimeMax =
        source.DispatchTimeMax;

    item.ListingDuration =
        source.ListingDuration;

    item.ListingType =
        source.ListingType;

    item.Location =
        source.Location;

    item.PostalCode =
        source.PostalCode;

    item.PrivateListing =
        source.PrivateListing;

    item.Quantity =
        source.Quantity;

    item.Site =
        source.Site;

    item.StartPrice =
        source.StartPrice;

    // Category

    if (source.PrimaryCategory) {
        item.PrimaryCategory = {
            CategoryID:
                source.PrimaryCategory.CategoryID
        };
    }

    if (source.SecondaryCategory) {
        item.SecondaryCategory = {
            CategoryID:
                source.SecondaryCategory.CategoryID
        };
    }

    // Best Offer

    if (source.BestOfferDetails) {
        item.BestOfferDetails = {
            BestOfferEnabled:
                source.BestOfferDetails.BestOfferEnabled
        };
    }

    // Product Details

    if (source.ProductListingDetails) {
        item.ProductListingDetails = {
            ...source.ProductListingDetails
        };
    }

    // Store Categories

    if (source.Storefront) {
        item.Storefront = {
            ...source.Storefront
        };
    }

    // Seller Profiles (VERY IMPORTANT)

    if (source.SellerProfiles) {
        item.SellerProfiles = {
            ...source.SellerProfiles
        };
    }

    // Return Policy

    if (source.ReturnPolicy) {
        item.ReturnPolicy = {
            ...source.ReturnPolicy
        };
    }

    // Shipping

    if (source.ShippingDetails) {
        item.ShippingDetails = {
            ...source.ShippingDetails
        };
    }

    if (source.ShippingPackageDetails) {
        item.ShippingPackageDetails = {
            ...source.ShippingPackageDetails
        };
    }

    if (source.ShipToLocations) {
        item.ShipToLocations =
            source.ShipToLocations;
    }

    // Pictures

    if (source.PictureDetails) {
        item.PictureDetails = {
            GalleryType:
                source.PictureDetails.GalleryType,
            PictureURL:
                source.PictureDetails.PictureURL
        };
    }

    // Item Specifics

    if (
        source.ItemSpecifics &&
        source.ItemSpecifics.NameValueList
    ) {
        item.ItemSpecifics = {
            NameValueList:
                source.ItemSpecifics.NameValueList
        };
    }

    // Compatibility

    if (source.ItemCompatibilityList) {
        item.ItemCompatibilityList =
            source.ItemCompatibilityList;
    }

    // SKU

    if (source.SKU) {
        item.SKU = source.SKU;
    }

    // Subtitle

    if (source.SubTitle) {
        item.SubTitle =
            source.SubTitle;
    }

    // Payment Methods (legacy)

    if (source.PaymentMethods) {
        item.PaymentMethods =
            Array.isArray(source.PaymentMethods)
                ? source.PaymentMethods
                : [source.PaymentMethods];
    }

    if (source.PayPalEmailAddress) {
        item.PayPalEmailAddress =
            source.PayPalEmailAddress;
    }

    // Listing Details

    if (source.ListingDetails) {

        const listingDetails: any = {};

        if (
            source.ListingDetails
                .BestOfferAutoAcceptPrice
        ) {
            listingDetails
                .BestOfferAutoAcceptPrice =
                source.ListingDetails
                    .BestOfferAutoAcceptPrice;
        }

        if (
            source.ListingDetails
                .MinimumBestOfferPrice
        ) {
            listingDetails
                .MinimumBestOfferPrice =
                source.ListingDetails
                    .MinimumBestOfferPrice;
        }

        if (
            Object.keys(listingDetails)
                .length > 0
        ) {
            item.ListingDetails =
                listingDetails;
        }
    }

    // Quantity Restrictions

    if (
        source.QuantityRestrictionPerBuyer
    ) {
        item.QuantityRestrictionPerBuyer =
            source.QuantityRestrictionPerBuyer;
    }

    // VAT

    if (source.VATDetails) {
        item.VATDetails = {
            ...source.VATDetails
        };
    }

    // Charity

    if (source.Charity) {
        item.Charity = {
            ...source.Charity
        };
    }

    // Regulatory

    if (source.Regulatory) {
        item.Regulatory = {
            ...source.Regulatory
        };
    }

    // Video

    if (source.VideoDetails) {
        item.VideoDetails = {
            ...source.VideoDetails
        };
    }

    // Vehicle Listings

    if (source.VIN) {
        item.VIN = source.VIN;
    }

    if (source.VRM) {
        item.VRM = source.VRM;
    }

    // Variations

    if (source.Variations) {
        item.Variations = {
            ...source.Variations
        };
    }

    return item;
}

function buildCategory(name: string, category: any): string {

    if (!category?.CategoryID) {
        return '';
    }

    return `<${name}><CategoryID>${category.CategoryID}</CategoryID></${name}>`;
}

function buildProductListingDetails(details: any): string {

    if (!details) {
        return '';
    }

    return `
<ProductListingDetails>
    ${details.BrandMPN? `<BrandMPN>${xmlNode('Brand', details.BrandMPN.Brand)}${xmlNode('MPN', details.BrandMPN.MPN)}</BrandMPN>`: ''}
    ${xmlNode('UPC', details.UPC)}
    ${xmlNode('EAN', details.EAN)}
    ${xmlNode('ISBN', details.ISBN)}
</ProductListingDetails>`;
}

function buildPictureDetails(pictureDetails: any): string {

    if (!pictureDetails) {
        return '';
    }

    const urls = pictureDetails.PictureURL || [];

    return `
<PictureDetails>
    ${xmlNode('GalleryType',pictureDetails.GalleryType)}
    ${urls
        .map(
            (url: string) =>
                `<PictureURL>${escapeXml(url)}</PictureURL>`
        ).join('')}
</PictureDetails>`;
}

function buildItemSpecifics(itemSpecifics: any): string {

    const specifics = itemSpecifics?.NameValueList;

    if (!specifics?.length) {
        return '';
    }

    return `
<ItemSpecifics>
    ${specifics.map((specific: any) => {
        const values = Array.isArray(specific.Value) ? specific.Value : [specific.Value];

        return `
    <NameValueList>
        <Name>${escapeXml(specific.Name)}</Name>
        ${values
            .map(
                (value: string) =>
                    `<Value>${escapeXml(value)}</Value>`
            ).join('')}
    </NameValueList>`;
    }).join('')}
</ItemSpecifics>`;
}

function buildReturnPolicy(policy: any): string {

    if (!policy) {
        return '';
    }

    return `
<ReturnPolicy>
    ${xmlNode('RefundOption', policy.RefundOption)}
    ${xmlNode('ReturnsAcceptedOption', policy.ReturnsAcceptedOption)}
    ${xmlNode('ReturnsWithinOption', policy.ReturnsWithinOption)}
    ${xmlNode('ShippingCostPaidByOption', policy.ShippingCostPaidByOption)}
    ${xmlNode('InternationalRefundOption', policy.InternationalRefundOption)}
    ${xmlNode('InternationalReturnsAcceptedOption', policy.InternationalReturnsAcceptedOption)}
    ${xmlNode('InternationalReturnsWithinOption', policy.InternationalReturnsWithinOption)}
    ${xmlNode('InternationalShippingCostPaidByOption', policy.InternationalShippingCostPaidByOption)}
</ReturnPolicy>`;
}

function buildShippingDetails(shipping: any, currency = 'USD'): string {

    if (!shipping) {
        return '';
    }

    return `
<ShippingDetails>
    ${xmlNode('ShippingType', shipping.ShippingType)}
    ${xmlNode('GlobalShipping', shipping.GlobalShipping)}
    ${xmlNode('PromotionalShippingDiscount', shipping.PromotionalShippingDiscount)}

    ${shipping.ShippingServiceOptions
            ?.map(
                (service: any) => `
<ShippingServiceOptions>
    ${xmlNode('ShippingService', service.ShippingService)}
    ${xmlNode('ShippingServicePriority', service.ShippingServicePriority)}
    ${xmlNode('FreeShipping', service.FreeShipping)}
    ${xmlAmountNode('ShippingServiceCost', service.ShippingServiceCost, currency)}
    ${xmlAmountNode('ShippingServiceAdditionalCost', service.ShippingServiceAdditionalCost, currency)}
</ShippingServiceOptions>`).join('') || ''
    }
    ${shipping.InternationalShippingServiceOption
        ?.map(
            (service: any) => `
<InternationalShippingServiceOption>
    ${xmlNode('ShippingService', service.ShippingService)}
    ${xmlNode('ShippingServicePriority', service.ShippingServicePriority)}
    ${xmlAmountNode('ShippingServiceCost', service.ShippingServiceCost, currency)}
</InternationalShippingServiceOption>`).join('') || ''
    }
</ShippingDetails>`;
}

function buildShippingPackageDetails(details: any): string {

    if (!details) {
        return '';
    }

    return `
<ShippingPackageDetails>
    ${xmlNode('PackageDepth', details.PackageDepth)}
    ${xmlNode('PackageLength', details.PackageLength)}
    ${xmlNode('PackageWidth', details.PackageWidth)}
    ${xmlNode('ShippingIrregular', details.ShippingIrregular)}
    ${xmlNode('ShippingPackage', details.ShippingPackage)}
    ${xmlNode('WeightMajor', details.WeightMajor)}
    ${xmlNode('WeightMinor', details.WeightMinor)}
</ShippingPackageDetails>`;
}

function buildSellerProfiles(profiles: any): string {

    if (!profiles) {
        return '';
    }

    return `
<SellerProfiles>
    ${
        profiles.SellerPaymentProfile? `
<SellerPaymentProfile>
    ${xmlNode('PaymentProfileID', profiles.SellerPaymentProfile.PaymentProfileID)}
</SellerPaymentProfile>
`
        : ''
    }
    ${
        profiles.SellerReturnProfile? `
<SellerReturnProfile>
    ${xmlNode('ReturnProfileID', profiles.SellerReturnProfile.ReturnProfileID)}
</SellerReturnProfile>
`
            : ''
    }
    ${
        profiles.SellerShippingProfile? `
<SellerShippingProfile>
    ${xmlNode('ShippingProfileID', profiles.SellerShippingProfile.ShippingProfileID)}
</SellerShippingProfile>
`
            : ''
    }
</SellerProfiles>`;
}

export function buildAddItemXml(ebayAuthToken: string, item: any): string {

    const currency =
        item.Currency || 'USD';

    return `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">

    <RequesterCredentials>
        <eBayAuthToken>${escapeXml(ebayAuthToken)}</eBayAuthToken>
    </RequesterCredentials>
    <ErrorLanguage>en_US</ErrorLanguage>
    <WarningLevel>High</WarningLevel>
    <Item>
        ${xmlNode('Title', item.Title)}
        ${xmlNode('Description', item.Description)}
        ${xmlNode('AutoPay', item.AutoPay)}
        ${xmlNode('ConditionID', item.ConditionID)}
        ${xmlNode('ConditionDescription', item.ConditionDescription)}
        ${xmlNode('Country', item.Country)}
        ${xmlNode('Currency', currency)}
        ${xmlNode('DispatchTimeMax', item.DispatchTimeMax)}
        ${xmlNode('ListingDuration', item.ListingDuration)}
        ${xmlNode('ListingType', item.ListingType)}
        ${xmlNode('Location', item.Location)}
        ${xmlNode('PostalCode', item.PostalCode)}
        ${xmlNode('PrivateListing', item.PrivateListing)}
        ${xmlNode('Quantity',item.Quantity)}
        ${xmlNode('Site', item.Site)}
        ${xmlAmountNode('StartPrice', item.StartPrice, currency)}
        ${xmlNode('SKU', item.SKU)}
        ${xmlNode('SubTitle', item.SubTitle)}
        ${buildCategory('PrimaryCategory', item.PrimaryCategory)}
        ${buildCategory('SecondaryCategory', item.SecondaryCategory)}
        ${item.BestOfferDetails?.BestOfferEnabled? `<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>` : ''}
        ${buildProductListingDetails(item.ProductListingDetails)}
        ${buildPictureDetails(item.PictureDetails)}
        ${buildItemSpecifics(item.ItemSpecifics)}
        ${buildReturnPolicy(item.ReturnPolicy)}
        ${buildShippingDetails(item.ShippingDetails, currency)}
        ${buildShippingPackageDetails(item.ShippingPackageDetails)}
        ${buildSellerProfiles(item.SellerProfiles)}
    </Item>
</AddItemRequest>`;
}

export async function addEbayItem(locals: App.Locals, xmlBody: any): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`addEbayItem: called, using access token: ${locals.ebayAccessToken}`);

    console.log('addEbayItem: AddItem XML:', xmlBody);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'AddItem',
    };

    console.log('ebayUtils: addEbayItem headers:', JSON.stringify(headers));
    
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
            console.log(`addEbayItem: AddItem data: ${JSON.stringify(jsonData)}`);
            // console.log(`getMyEbayItem response.status: ${JSON.stringify(response.status)}`);

            if (!jsonData.AddItemResponse?.Ack) {
                console.log('No items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            console.log(`ebayUtils: addEbayItem data: ${JSON.stringify(data)}`);
            // console.log(`ebayUtils: addEbayItem response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error addEbayItem:', error);
        return {
            status: 500,
            data: {}
        };
    }


    return {
        status: 200,
        data: { xmlBody }
    };
}

export async function delistEbayItem(locals: App.Locals, itemId: string): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`ebayUtils: delistEbayItem called, using access token: ${locals.ebayAccessToken}, ItemId: ${itemId}`);

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'EndItem',
    };

    console.log('ebayUtils: delistEbayItem headers:', JSON.stringify(headers));

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
        <ItemID>${itemId}</ItemID>
        <EndingReason>Incorrect</EndingReason>
    </EndItemRequest>`;

    console.log('ebayUtils: delistEbayItem xmlBody:', xmlBody);

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
            console.log(`ebayUtils: delistEbayItem data: ${JSON.stringify(jsonData)}`);
            // console.log(`getMyEbayItem response.status: ${JSON.stringify(response.status)}`);

            if (!jsonData.EndItemResponse?.Ack) {
                console.log('No items found in the response.');
                return {
                    status: response.status,
                    data: {}
                };
            }

            return {
                status: response.status,
                data: jsonData
            };
        } else {
            console.log(`ebayUtils: delistEbayItem data: ${JSON.stringify(data)}`);
            // console.log(`ebayUtils: delistEbayItem response.status: ${JSON.stringify(response.status)}`);

            return {
                status: response.status,
                message: JSON.stringify(data)
            };
        }
    } catch (error) {
        console.error('Error delistEbayItem:', error);
        return {
            status: 500,
            data: {}
        };
    }
}

export async function relistEbayItemsWithPriceChange(locals: App.Locals, itemId: string, priceChange: number): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log(`ebayUtils: relistEbayItemsWithPriceChange called, using access token: ${locals.ebayAccessToken}, ItemId: ${itemId}, PriceChange: ${priceChange}`);

    // The price change is a percentage either positive (increase) or negative (decrease) and cannot be greater than
    // or less than 50% for safety reasons
    if (priceChange > 50 || priceChange < -50) {
        return {
            status: 400,
            message: 'Invalid price change, must be between -50% and 50%'
        };
    }

    // Get the current information for the item from eBay before attempting to relist it with a price change
    // Pass blank output selector so it does not limit what is returned
    const itemData = await getMyEbayItem(locals, itemId, []);

    if (!('data' in itemData) || itemData.status !== 200 || !itemData.data.GetItemResponse?.Item) {
        console.error('Failed to fetch item details from eBay API');
        return {
            status: 400,
            message: 'Failed to fetch item details from eBay API'
        };
    }

    const ebayItem = itemData.data.GetItemResponse.Item;
    console.log(`relistEbayItemsWithPriceChange: ebayItem=${JSON.stringify(ebayItem)}`);

    const currentPrice = ebayItem.SellingStatus.CurrentPrice;
    console.log(`relistEbayItemsWithPriceChange: currentPrice=${currentPrice}`);

    // The priceChange is a percentage, so calculate the new price accordingly.
    // Make sure it is rounded to 2 decimal places
    const newPrice = Math.round(currentPrice * (1 + priceChange / 100) * 100) / 100;
    console.log(`relistEbayItemsWithPriceChange: newPrice=${newPrice}`);

    const clonedItem = mapGetItemToAddItem(ebayItem);

    clonedItem.StartPrice = newPrice;
    clonedItem.Title += ' 🔥';

    // Build the request body for relisting the item with the new price.
    const addItemRequest = buildAddItemXml(locals.ebayAccessToken as string, clonedItem);
    console.log(`relistEbayItemsWithPriceChange: addItemRequest=${JSON.stringify(addItemRequest)}`);

    // Attempt to use the new additem request to relist the item with the updated price.
    const addItemResult = await addEbayItem(locals, addItemRequest);

    if (addItemResult.status !== 200) {
        console.error('Failed to add item to eBay API');
        return {
            status: 400,
            message: 'Failed to add item to eBay API'
        };
    }

    console.log(`relistEbayItemsWithPriceChange: addItemResult=${JSON.stringify(addItemResult)}`);
    // Now delist the item from eBay before relisting it with the new price.
    // const delistResult = await delistEbayItem(locals, itemId);

    // if (delistResult.status !== 200) {
    //     console.error('Failed to delist item from eBay API');
    //     return {
    //         status: 400,
    //         message: 'Failed to delist item from eBay API'
    //     };
    // }

    // console.log(`relistEbayItemsWithPriceChange: delistResult=${JSON.stringify(delistResult)}`);

    // // Look at the Ack to make sure it says success
    // if (!('data' in delistResult) || delistResult.data?.Ack !== 'Success') {
    //     console.error('relistEbayItemsWithPriceChange: Delist item did not return success from eBay API');
    //     return {
    //         status: 400,
    //         message: 'Delist item did not return success from eBay API'
    //     };
    // }

    // Hold onto the ebay item data because we are going to delist and then re add it with the new price.

    return {
        status: 200,
        message: 'OK'
    };
}

export async function getUser(locals: App.Locals): Promise<Result<string>> {
    console.log('getUser called');

    const headers = {
        'Content-Type': 'text/xml',
        'Connection': 'Keep-Alive',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-DEV-NAME': env.EBAY_DEV_ID || '',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-CALL-NAME': 'GetUser',
    };

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <RequesterCredentials>
            <eBayAuthToken>${locals.ebayAccessToken}</eBayAuthToken>
        </RequesterCredentials>
    </GetUserRequest>`;

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

            console.log(`getUser response status: ${response.status}`);

            // Extract UserID from the response
            const userId = jsonData.GetUserResponse?.User?.UserID;

            if (!userId) {
                console.error('UserID not found in eBay GetUser response');
                return {
                    status: 'error',
                    message: 'UserID not found in eBay response'
                };
            }

            console.log(`getUser retrieved UserID: ${userId}`);

            return {
                status: 'success',
                data: userId
            };
        } else {
            console.error(`getUser error response: ${response.status} - ${data}`);
            return {
                status: 'error',
                message: `eBay API error: ${response.status}`
            };
        }
    } catch (error) {
        console.error('Error getUser:', error);
        return {
            status: 'error',
            message: `Error retrieving user: ${error}`
        };
    }
}
