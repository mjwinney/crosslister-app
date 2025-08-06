import fetch from 'node-fetch'; // Ensure you have node-fetch installed
import { json } from '@sveltejs/kit';
// If EBAY_USER_TOKEN is defined in your .env file, use the dynamic import:
import { env } from '$env/dynamic/private';

// Example: Retrieve listed items from eBay API
export async function GET() {
    const sku = '1234567890AB';
    const endpoint = `https://api.sandbox.ebay.com/sell/inventory/v1/inventory_item/${sku}`; // Replace with your endpoint
    const token = env.EBAY_USER_TOKEN;

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-language': 'en-US',
    };

    const body = {
        "availability": {
            "pickupAtLocationAvailability": [
                {
                    "availabilityType": "IN_STOCK",
                    "fulfillmentTime": {
                        "unit": "DAY",
                        "value": "30"
                    },
                    "merchantLocationKey": "Wisconsin",
                    "quantity": "10"
                }
            ],
            "shipToLocationAvailability": {
                "availabilityDistributions": [
                    {
                        "fulfillmentTime": {
                            "unit": "DAY",
                            "value": "30"
                        },
                        "merchantLocationKey": "Wisconsin",
                        "quantity": "10"
                    }
                ],
                "quantity": "10"
            }
        },
        "condition": "NEW",
        "conditionDescription": "Very good condition",
        "conditionDescriptors": [
            {
                "additionalInfo": "additional info",
                "name": "string",
                "values": [
                    "string"
                ]
            }
        ],
        "packageWeightAndSize": {
            "dimensions": {
                "height": "1",
                "length": "1",
                "unit": "FEET",
                "width": "1"
            },
            "packageType": "LETTER",
            "shippingIrregular": "false",
            "weight": {
                "unit": "POUND",
                "value": "10"
            }
        },
        "product": {
            "aspects": {
                "Brand": [
                    "GoPro"
                ],
                "Storage Type": [
                    "Removable"
                ]
            },
            "brand": "expensive",
            "description": "Very nice product description",
            "ean": [
                "string"
            ],
            "epid": "string",
            "imageUrls": [
                "https://i*****g.com/0**********/**********1.jpg"
            ],
            "isbn": [
                "string"
            ],
            "mpn": "string",
            "subtitle": "Very big product subtitle",
            "title": "Very big product title",
            "upc": [
                "string"
            ],
            "videoIds": [
                "string"
            ]
        }
    };

    console.log('body:', JSON.stringify(body));

    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(`eBay API error: ${response.status} - ${errorText}`, { status: response.status });
        }

        return new Response(JSON.stringify({ message: 'Item created' }), { status: 200 });
    } catch (error) {
        console.error('Error making eBay API request:', error);
        return new Response('Internal server error', { status: 500 });
    }
}