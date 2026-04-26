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

type EBayCategoryIdMap = {
  [key: number]: string;
};

const EBayCategoryIdMap: EBayCategoryIdMap = {
  150044: "Electronics:Cameras & Photo:Digital Photo Frames",
  159903: "Home:Kitchen, Dining & Bar:Small Kitchen Appliances:Microwave Parts",
  4684 : "Electronics:Cameras & Photo:Camera Manuals & Guides"
  // Add more as needed
};

type PoshmarkSubCategoryIdMap = {
  [key: string]: { [key: string]: string };
};

const PoshmarkSubCategoryIdMap: PoshmarkSubCategoryIdMap = {
  "Women": {
    "accessories": "Accessories",
    "bags": "Bags",
    "dresses": "Dresses",
    "intimates &amp; sleepwear": "Intimates &amp; Sleepwear",
    "jackets &amp; coats": "Jackets &amp; Coats",
    "jeans": "Jeans",
    "jewelry": "Jewelry",
    "makeup": "Makeup",
    "pants &amp; Jumpsuits": "Pants &amp; Jumpsuits",
    "shoes": "Shoes",
    "shorts": "Shorts",
    "skirts": "Skirts",
    "sweaters": "Sweaters",
    "swim": "Swim",
    "tops": "Tops",
    "skincare": "Skincare",
    "hair": "Hair",
    "bath &amp; body": "Bath &amp; Body",
    "global &amp; Traditional Wear": "Global &amp; Traditional Wear",
    "other": "Other"
  },
  "Men": {
    "accessories": "Accessories",
    "bags": "Bags",
    "jackets &amp; Coats": "Jackets &amp; Coats",
    "jeans": "Jeans",
    "pants": "Pants",
    "shirts": "Shirts",
    "shoes": "Shoes",
    "shorts": "Shorts",
    "suits &amp; Blazers": "Suits &amp; Blazers",
    "sweaters": "Sweaters",
    "swim": "Swim",
    "underwear &amp; socks": "Underwear &amp; Socks",
    "grooming": "Grooming",
    "global &amp; Traditional Wear": "Global &amp; Traditional Wear",
    "other": "Other"
  },
  "Kids": {
    "accessories": "Accessories",
    "bottoms": "Bottoms",
    "dresses": "Dresses",
    "jackets &amp; coats": "Jackets &amp; Coats",
    "matching sets": "Matching Sets",
    "one pieces": "One Pieces",
    "pajamas": "Pajamas",
    "shirts &amp; tops": "Shirts &amp; Tops",
    "shoes": "Shoes",
    "swim": "Swim",
    "costumes": "Costumes",
    "bath, Skin &amp; Hair": "Bath, Skin &amp; Hair",
    "toys": "Toys",
    "other": "Other"
  },
  "Home": {
    "accents": "Accents",
    "art": "Art",
    "bath": "Bath",
    "bedding": "Bedding",
    "design": "Design",
    "dining": "Dining",
    "games": "Games",
    "holiday": "Holiday",
    "kitchen": "Kitchen",
    "office": "Office",
    "party supplies": "Party Supplies",
    "storage &amp; organization": "Storage &amp; Organization",
    "wall decor": "Wall Decor",
    "other": "Other"
  },
  "Pets": {
    "dog": "Dog",
    "cat": "Cat",
    "bird": "Bird",
    "fish": "Fish",
    "reptile": "Reptile",
    "small pets": "Small Pets",
    "other": "Other"
  },
  "Electronics": {
    "cameras & photo": "Cameras, Photo &amp; Video",
    "computers & laptops": "Computers, Laptops &amp; Parts",
    "cell phones &amp; accessories": "Cell Phones &amp; Accessories",
    "car audio, video &amp; gps": "Car Audio, Video &amp; GPS",
    "wearables": "Wearables",
    "tablets &amp; accessories": "Tablets &amp; Accessories",
    "video games &amp; consoles": "Video Games &amp; Consoles",
    "VR, AR &amp; Accessories": "VR, AR &amp; Accessories",
    "media": "Media",
    "Networking": "Networking",
    "Headphones": "Headphones",
    "Portable Audio &amp; Video": "Portable Audio &amp; Video",
    "other": "Other"
  }
};

function normalizeEbayCategory(categoryID : number, categoryName : string): string {
  console.log("normalizeEbayCategory: categoryID:", categoryID, "categoryName:", categoryName);
  // If we have a full path for this ID, use it
  if (EBayCategoryIdMap[categoryID]) {
    return EBayCategoryIdMap[categoryID];
  }

  // Otherwise fall back to the API's CategoryName
  return categoryName;
}

function parseEbayCategoryPath(categoryName: string): string[] {
  // Example input: "Clothing, Shoes & Accessories:Women:Women's Clothing:Tops & T-Shirts"

  console.log("parseEbayCategoryPath: Parsing eBay category path:", categoryName);

  return categoryName.split(":").map(s => s.trim());
}

function mapToPoshTopLevel(pathParts: string[]): string {
  console.log("mapToPoshTopLevel: Mapping to Poshmark top level from path parts:", pathParts);
  const full = pathParts.join(" ").toLowerCase();

  if (full.includes("women")) return "Women";
  if (full.includes("men")) return "Men";
  if (full.includes("kids") || full.includes("girls") || full.includes("boys") || full.includes("baby"))
    return "Kids";
  if (full.includes("home") || full.includes("furniture") || full.includes("decor"))
    return "Home";
  if (full.includes("pet") || full.includes("dog") || full.includes("cat"))
    return "Pets";
  if (full.includes("electronics") || full.includes("phone") || full.includes("audio"))
    return "Electronics";

  // fallback
  return "Women";
}

function mapToPoshSubcategory(topLevel: string, pathParts: string[]): string | null {
  console.log("mapToPoshSubcategory: Mapping to Poshmark subcategory from top level:", topLevel, "and path parts:", pathParts);
  const map = PoshmarkSubCategoryIdMap[topLevel];
  if (!map) return null;

  console.log("mapToPoshSubcategory: Available subcategories for top level:", map);

  for (let part of pathParts) {
    console.log("mapToPoshSubcategory: Checking part:", part);
    const key = part.toLowerCase();
    console.log("mapToPoshSubcategory: Normalized part for matching:", key);
    if (map[key]) {
      console.log("mapToPoshSubcategory: Found matching subcategory:", map[key]);
      return map[key];
    }
  }

  return map['other'];
}

function mapEbayCategoryToPoshmark(categoryID: number, categoryName: string): { poshTopLevel: string, poshSubcategory: string | null, normalizedEbayPath: string } {
  console.log(`mapEbayCategoryToPoshmark: categoryID=${categoryID}, categoryName="${categoryName}"`);
  const normalized = normalizeEbayCategory(categoryID, categoryName);
  console.log(`mapEbayCategoryToPoshmark: normalized="${normalized}"`);
  const path = parseEbayCategoryPath(normalized);
  console.log(`mapEbayCategoryToPoshmark: path=`, path);

  const topLevel = mapToPoshTopLevel(path);
  console.log(`mapEbayCategoryToPoshmark: Mapped to top-level category "${topLevel}"`);
  const subcategory = mapToPoshSubcategory(topLevel, path);
  console.log(`mapEbayCategoryToPoshmark: Mapped to subcategory "${subcategory}"`);

  return {
    poshTopLevel: topLevel,
    poshSubcategory: subcategory,
    normalizedEbayPath: normalized
  };
}

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

    const pictureURL = ebayItem.PictureDetails?.PictureURL;
    const pictureURLs = Array.isArray(pictureURL)
      ? pictureURL
      : pictureURL
        ? [pictureURL]
        : [];

    // build the response.
    const responseData = {
      title: ebayItem.Title,
      pictureURL: pictureURLs,
      description: cleanForPoshmark(ebayItem.Description) + 
        (ebayItem.ConditionDescription ? "\n\n" + "Condition:\n" + ebayItem.ConditionDescription : ""),
      condition: mapEbayToPoshmarkCondition(ebayItem.ConditionID),
      category: mapEbayCategoryToPoshmark(ebayItem.PrimaryCategory.CategoryID, ebayItem.PrimaryCategory.CategoryName),
      // price: String(ebayItem.SellingStatus.CurrentPrice)
      price: ebayItem.SellingStatus.CurrentPrice
    };

    return new Response(JSON.stringify({ message: 'Item details fetched successfully', itemDetails: responseData }), { status: 200 });

    //     console.log(`POST: metaData:${JSON.stringify(metaData)}`);


    // return new Response(JSON.stringify({ message: 'Items saved successfully' }), { status: 200 });

};
