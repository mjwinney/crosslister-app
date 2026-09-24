import { json } from "@sveltejs/kit";
import { env } from '$env/dynamic/private';
import { type MetaDataModel, getEbayMetadata, StatusCodes, updateActiveEbayItem, updateEbayMetadata, updateEbayToken, updatePoshmarkMetadata } from "./DatabaseUtils";
import { XMLParser } from "fast-xml-parser";
import { da } from "date-fns/locale";

export async function getPoshmarkOrders(request: Request, locals: App.Locals, page: number): Promise<{ status: number; data: any; } | { status: number; message: string; }> {
    console.log('POST: ENTER');
    const data = await request.json();

    for (const item of data) {
        const itemId = item.id;
        const userId = locals?.session?.userId || '';

        console.log(`POST: itemId:${itemId}, userId:${userId}`);
        const diff = (item.total_price_amount?.val ?? 0) - (item.total_earnings_amount?.val ?? 0);
        const feeAmount = Number(diff.toFixed(2));

        const metaData: MetaDataModel = {
            title: item.title,
            pictureURL: item.picture_url,
            soldTime: item.inventory_booked_at,
            soldPrice: item.total_price_amount?.val,
            feePrice: feeAmount
        };

        console.log(`POST: metaData:${JSON.stringify(metaData)}`);
        await updatePoshmarkMetadata(userId, itemId, metaData, true);
    }

    return { status: 200, data: { ok: true } };
}
