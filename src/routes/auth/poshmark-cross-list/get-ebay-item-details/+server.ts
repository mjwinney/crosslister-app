import { updatePoshmarkMetadata, getPoshmarkMetadataByPage, type MetaDataModel } from "$lib/server/DatabaseUtils";
import { getMyEbayItem } from "$lib/server/ebayUtils";

function cleanForPoshmark(html : string | undefined): string {
  if (!html) return "";

  // 1. Convert HTML entities like &nbsp; → space
  let text = html.replace(/&nbsp;/g, " ");

  // 2. Convert <br> and <br/> to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // 3. Convert <div>...</div> to "...\n"
  text = text.replace(/<\/div>\s*<div>/gi, "\n"); // consecutive divs
  text = text.replace(/<div>/gi, "");            // remove opening div
  text = text.replace(/<\/div>/gi, "\n");        // closing div → newline

  // 4. Strip any remaining HTML tags just in case
  text = text.replace(/<[^>]+>/g, "");

  // 5. Collapse multiple newlines into a single blank line
  text = text.replace(/\n{3,}/g, "\n\n");

  // 6. Trim leading/trailing whitespace
  return text.trim();
}

type PoshmarkCondition =
  | "New With Tags (NWT)"
  | "Like New"
  | "Good"
  | "Fair";

// Explicit sets give you precision + easy extensibility
const NEW = new Set<number>([
  1000, // New
  1500, // New with defects (optional: treat differently)
]);

const LIKE_NEW = new Set<number>([
  2750, // Open box (unused)
  2990, // Pre-owned - Excellent
  3000, // Used - Like New
]);

const GOOD = new Set<number>([
  4000, // Used - Very Good
  5000, // Used - Good
]);

const FAIR = new Set<number>([
  6000, // Used - Acceptable
  7000, // For parts / not working (cosmetic)
]);

/**
 * Maps an eBay ConditionID to a Poshmark condition.
 * Falls back to "Good" if unknown.
 */
function mapEbayToPoshmarkCondition(conditionId: number): PoshmarkCondition {
  if (NEW.has(conditionId)) return "New With Tags (NWT)";
  if (LIKE_NEW.has(conditionId)) return "Like New";
  if (GOOD.has(conditionId)) return "Good";
  if (FAIR.has(conditionId)) return "Fair";

  // Fallback — safest default for unknown IDs
  return "Good";
}

export const POST = async ({ request, locals }) => {
    console.log('POST: ENTER');
    const form = await request.formData();
    const itemIdData = form.get('itemId');
    console.log(`itemId=${JSON.stringify(itemIdData)}`);
    const itemId = JSON.parse(itemIdData as string);

    console.log(`POST: itemId=${itemId}`);
    // // console.log(`POST: locals:${JSON.stringify(locals)}`);
    const userId = locals?.session?.userId || '';

    // Call eBay API to get item details for each item in the parsed data
    const itemData = await getMyEbayItem(locals, itemId, [
      'Description', 
      'ConditionDescription',
      'ConditionID',
      'Title',
      'PictureDetails',
      'PrimaryCategory',
      'SellingStatus'
    ]);

    if (!('data' in itemData) || itemData.status !== 200 || !itemData.data.GetItemResponse?.Item) {
        console.error('Failed to fetch item details from eBay API');
        return new Response(JSON.stringify({ message: 'Failed to fetch item details from eBay API' }), { status: 500 });
    }

    const ebayItem = itemData.data.GetItemResponse.Item;
    console.log(`POST: ebayItem=${JSON.stringify(ebayItem)}`);

    // build the response.
    const responseData = {
      title: ebayItem.Title,
      pictureURL: ebayItem.PictureDetails?.PictureURL,
      description: cleanForPoshmark(ebayItem.Description) + 
        (ebayItem.ConditionDescription ? 
          "\n\n" + "Condition:\n" + ebayItem.ConditionDescription : ""),
      condition: mapEbayToPoshmarkCondition(ebayItem.ConditionID),
      primaryCategory: ebayItem.PrimaryCategory,
      // price: String(ebayItem.SellingStatus.CurrentPrice)
      price: ebayItem.SellingStatus.CurrentPrice
    };

    return new Response(JSON.stringify({ message: 'Item details fetched successfully', itemDetails: responseData }), { status: 200 });

    //     console.log(`POST: metaData:${JSON.stringify(metaData)}`);


    // return new Response(JSON.stringify({ message: 'Items saved successfully' }), { status: 200 });

};
