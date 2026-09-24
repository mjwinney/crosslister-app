import { StatusCodes, updateEbayMetadata, type MetaDataModel } from '$lib/server/DatabaseUtils';
import { getMyEbaySellingActive, getMyEbaySellingSold, findItemsByKeywords } from '$lib/server/ebayUtils';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';

type NormalizedItem = {
    itemId: string;
    title: string;
    price: string;
    imageUrl: string;
    condition?: string;
    category?: string;
    description?: string;
    metadata: MetaDataModel;
    sourceItem?: any;
};

function toArray<T>(value: T | T[] | undefined | null): T[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

function ensureMetadata(item: any): MetaDataModel {
    return item.Metadata ?? {
        purchasePrice: 0,
        purchaseDate: '',
        purchaseLocation: '',
        storageLocation: ''
    };
}

function normalizeActiveItem(item: any): NormalizedItem {
    return {
        itemId: String(item.ItemID ?? item.itemId ?? ''),
        title: item.Title ?? item.title ?? '',
        price: String(item.SellingStatus?.CurrentPrice ?? item.StartPrice ?? '0.00'),
        imageUrl: item.PictureDetails?.GalleryURL ?? item.PictureDetails?.PictureURL ?? '',
        condition: item.ConditionDisplayName ?? item.Condition?.DisplayName,
        category: item.PrimaryCategory?.CategoryName ?? item.PrimaryCategory?.CategoryID,
        description: item.Description ?? item.ShortDescription ?? '',
        metadata: ensureMetadata(item),
        sourceItem: item
    };
}

function normalizeSearchItem(item: any): NormalizedItem {
    return {
        itemId: String(item.itemId ?? item.ItemID ?? ''),
        title: item.title ?? item.title ?? item.subtitle ?? '',
        price: String(item.price?.value ?? item.price ?? '0.00'),
        imageUrl: item.image?.imageUrl ?? item.imageUrl ?? '',
        condition: item.condition ?? item.condition ?? '',
        category: item.category ?? item.category ?? '',
        description: item.description ?? item.shortDescription ?? '',
        metadata: ensureMetadata(item),
        sourceItem: item
    };
}

function normalizeItemData(post: any): {
    normalizedItems: NormalizedItem[];
    totalItems: number;
    totalNumberOfPages: number;
} {
    if (!post) {
        return { normalizedItems: [], totalItems: 0, totalNumberOfPages: 1 };
    }

    if (post.GetMyeBaySellingResponse?.ActiveList?.ItemArray?.Item) {
        const items = toArray(post.GetMyeBaySellingResponse.ActiveList.ItemArray.Item).map(normalizeActiveItem);
        const totalItems = parseInt(post.GetMyeBaySellingResponse.ActiveList.PaginationResult.TotalNumberOfEntries ?? '0', 10) || items.length;
        const totalNumberOfPages = parseInt(post.GetMyeBaySellingResponse.ActiveList.PaginationResult.TotalNumberOfPages ?? '1', 10) || 1;
        return { normalizedItems: items, totalItems, totalNumberOfPages };
    }

    return { normalizedItems: [], totalItems: 0, totalNumberOfPages: 1 };
}

function normalizeSearchData(post: any): {
    normalizedItems: NormalizedItem[];
    totalItems: number;
    totalNumberOfPages: number;
} {
    if (!post) {
        return { normalizedItems: [], totalItems: 0, totalNumberOfPages: 1 };
    }

    if (Array.isArray(post.itemSummaries)) {
        const items = post.itemSummaries.map(normalizeSearchItem);
        const totalItems = Number(post.total ?? post.itemSummaries.length ?? 0) || items.length;
        const pageSize = post.limit ?? 20;
        const totalNumberOfPages = pageSize > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
        return { normalizedItems: items, totalItems, totalNumberOfPages };
    }

    return { normalizedItems: [], totalItems: 0, totalNumberOfPages: 1 };
}

export const load: PageServerLoad = async ({ request, locals }) => {

    // Get the page query parameter
    const url = new URL(request.url);
    const pageParam = url.searchParams.get('page');
    const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
    console.log('load: pageNumber:', pageNumber);
    const searchParam = url.searchParams.get('search');
    console.log('load: searchParam:', searchParam);

    // If we have a search term, perform a search instead of loading active items
    if (searchParam) {
        console.log('load: searchParam:', searchParam);
        const searchResponse = await findItemsByKeywords(locals, searchParam, pageNumber, 'newlyListed');
        if (searchResponse.status !== 200 || !('data' in searchResponse)) {
            return new Response('Failed to retrieve eBay inventory items', {
                status: 500,
                headers: { 'Content-Type': 'text/html' }
            });
        }
        console.log('eBay API search successful, searchResponse.data:', JSON.stringify(searchResponse.data));
        const { normalizedItems, totalItems, totalNumberOfPages } = normalizeSearchData(searchResponse.data);
        console.log('normalizedItems:', JSON.stringify(normalizedItems));
        console.log('totalItems:', JSON.stringify(totalItems));
        console.log('totalNumberOfPages:', JSON.stringify(totalNumberOfPages));
        return {
            post: {
                normalizedItems,
                totalItems,
                totalNumberOfPages,
                currentSearchTerm: searchParam
            }
        };
    }

    // If no search term, load active items
    const response = await getMyEbaySellingActive(locals, pageNumber);

    if (response.status !== 200 || !('data' in response)) {
        return new Response('Failed to retrieve eBay inventory items', {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    console.log('eBay API request successful, response.data:', JSON.stringify(response.data));
    const { normalizedItems, totalItems, totalNumberOfPages } = normalizeItemData(response.data);
    console.log('normalizedItems:', JSON.stringify(normalizedItems));
    console.log('totalItems:', JSON.stringify(totalItems));
    console.log('totalNumberOfPages:', JSON.stringify(totalNumberOfPages));
    return {
        post: {
            normalizedItems,
            totalItems,
            totalNumberOfPages,
            currentSearchTerm: searchParam ?? ''
        }
    };
};

export const actions: Actions = {
    updateItem: async ({ request }) => {
        console.log('updateItem: ENTER');
        console.log('updateItem: request:', request);
        const formData = await request.formData();
        console.log('updateItem: request JSON:', JSON.stringify(formData));

        const itemId = String(formData.get('itemId') ?? '').trim();
        const userId = String(formData.get('userId') ?? '').trim();
        const rawMetaData = formData.get('metaData');

        if (!itemId || !userId || !rawMetaData) {
            return fail(400, { message: 'itemId, userId, and metaData are required' });
        }

        let metaData: MetaDataModel;
        try {
            metaData = JSON.parse(String(rawMetaData));
        } catch {
            return fail(400, { message: 'metaData must be valid JSON' });
        }

        if (metaData.relistIntervalDays !== undefined) {
            const interval = Number(metaData.relistIntervalDays);
            if (!Number.isInteger(interval) || interval <= 0) {
                return fail(400, { message: 'relistIntervalDays must be a positive integer' });
            }
        }

        if (metaData.relistAt !== undefined && metaData.relistAt !== null && Number.isNaN(new Date(metaData.relistAt).getTime())) {
            return fail(400, { message: 'relistAt must be a valid date string or null' });
        }

        if (metaData.relistEnabled === false) {
            metaData.relistAt = null;
        }

        const existingRecord = await (await import('$lib/server/models/ebay-item-metadata')).EbayItemMetadata.findOne({ itemId }).select('userId').lean().exec();
        if (existingRecord && existingRecord.userId !== userId) {
            return fail(403, { message: 'You do not own this eBay item' });
        }

        console.log('updateItem: userId:', userId);

        const response = await updateEbayMetadata(userId, itemId, metaData, true);

        if (response !== StatusCodes.OK) {
            return fail(500, { message: "Failed to update eBay item metadata" });
        }

        console.log('eBay API request successful, success');
        return { success: true, message: 'Operation complete!' };
    },

    searchKeywords: async ({ request, locals }) => {
        console.log('searchKeywords: ENTER');
        const formData = await request.formData();
        const keywords = formData.get('keywords') as string;
        const page = parseInt(formData.get('page') as string) || 1;

        console.log('searchKeywords: keywords:', keywords, 'page:', page);

        const response = await findItemsByKeywords(locals, keywords, page, 'BEST_MATCH');

        if (response.status !== 200) {
            console.log('searchKeywords: search failed');
            return fail(500, { message: "Failed to search eBay items" });
            // return new Response('Failed to search eBay items', {
            //     status: response.status,
            //     headers: { 'Content-Type': 'application/json' }
            // });
        }

        console.log('searchKeywords: search successful');
        return { 
            success: true, 
            // data: response.data,
            // itemCount: response.data?.FindItemsByKeywordsResponse?.searchResult?.item 
            //     ? (Array.isArray(response.data.FindItemsByKeywordsResponse.searchResult.item) 
            //         ? response.data.FindItemsByKeywordsResponse.searchResult.item.length 
            //         : 1)
            //     : 0
        };
    },
};
