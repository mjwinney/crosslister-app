# Crosslist: Poshmark ⇄ eBay — Enhancement Plan

## Summary
Add the ability to cross-list from Poshmark to eBay (and to import active Poshmark listings), and to create eBay listings from Poshmark listing content. This extends the existing eBay→Poshmark flow to support the reverse direction and tighter tracking in the database.

## Goals
- Add ability to initiate cross-listing from a Poshmark listing page (client-side UI + extension automation).
- Add ability to retrieve active listings from Poshmark (scrape, similar to sold-items flow).
- Implement new eBay API server methods to create eBay listings using images and description scraped from Poshmark.
- Persist the returned eBay `itemId` in the database to mark a listing as cross-listed.

## High-level Architecture
- Web app: Add UI controls under poshmark `active-items` and new endpoints under `/auth/poshmark/*` to accept forwarded scraped data and to call server-side eBay API methods.
- Chrome extension: Extend `poshmark.js`, `background.js`, and `forwarder.js` to support extracting active listing details from Poshmark and forwarding scraped listing metadata to the web app. The extension does not call eBay APIs itself.
- Server: New server-side controller methods to call eBay API to create listings and to update MongoDB via existing `DatabaseUtils`/Mongoose models.
- Database: Add fields to the item metadata model to store `ebayItemId`, `crosslistedTo.ebay: { itemId, createdAt, status }`.

## Detailed Tasks
1. UI: Crosslist from Poshmark listing page
   - Add an `Import from Poshmark` action/button on `active-items` (`src/routes/auth/active-items/+page.svelte`) and possibly a separate `poshmark-active` route for listing previews.
   - Add a new Poshmark navigation entry under the Poshmark header in the app sidebar to surface active Poshmark listings alongside Dashboard and Sold.
   - UI will request the extension to retrieve active Poshmark listing data by posting a window message such as `IMPORT_POSHMARK_ACTIVE_LISTING` with `{ listingUrl }`.
   - Show a confirmation modal and a progress indicator while the extension automates collection and forwards Poshmark listing data.

2. Poshmark active listings retrieval (scrape)
   - Implement scraper logic in `xlister-chrome-extension/poshmark.js` similar to `scrapeSoldItems`, but target listing pages and user closet endpoints to return active listings (title, description, image URLs, condition, category, price).
   - Add a background message type `IMPORT_POSHMARK_ACTIVE_LISTING` and forward responses to the site using `forwarder.js` messages `POSHMARK_ACTIVE_DATA`.
   - Where possible reuse the `readUidFromMainWorld` approach for user context; fallback to page-context fetch techniques used in `poshmark.js`.

3. eBay create-listing server methods
   - Add endpoints under `src/routes/auth/poshmark/` or `src/routes/api/ebay/` (e.g., `/auth/poshmark/create-ebay-listing`) that accept Poshmark listing data (images, description, title, condition, category, price).
   - Research and develop a new eBay listing creation flow in `EbayUtils` to create draft listings, since the repo currently has no eBay create-item helper.
   - Implement server code to (A) download/prepare images (resize if necessary), (B) create the eBay listing as a draft using the appropriate eBay Sell API path, (C) handle result and errors, (D) return the `itemId` and draft listing URL or navigation target on success.
   - If possible, open a browser tab to the newly created eBay draft listing after it is created.
   - Add request validation and rate-limiting/queueing as needed.

4. Persist crosslist metadata
   - Extend the item metadata model used by MongoDB to include an entry for crosslist targets: `metadata.crosslisted = { poshmark?: {...}, ebay?: { itemId, createdAt, status, url } }`.
   - When eBay item is created successfully, call the existing DB update flow to store the `ebayItemId` and set status to `listed`.
   - Surface cross-list status on the `active-items` UI (show eBay icon/link similar to Poshmark's `posh-logo` block).

5. Chrome extension changes (summary)
   - `poshmark.js`: add handlers for new message types: `IMPORT_POSHMARK_ACTIVE_LISTING` (scrape single listing or user closet active items) and return listing data to the web app.
   - `background.js`: route new messages, persist session UID workarounds, and send scraped Poshmark metadata back to the web app.
   - `forwarder.js`: forward new messages between the page and background: `IMPORT_POSHMARK_ACTIVE_LISTING`, `POSHMARK_ACTIVE_DATA`, and `POSHMARK_LISTING_READY`.

6. API & Security considerations
   - The extension runs in the user's browser and has access to Poshmark cookies; server-side calls to eBay must use the web app's configured eBay credentials (existing pattern). Ensure the server validates the user session before creating an eBay listing on their behalf.
   - Avoid sending user cookies to the server. Instead, use the extension to collect listing data (images, text) and forward sanitized payloads (image URLs or blobs) to the server, which uses its own eBay account/credentials to create listings.
   - If eBay calls must be made on behalf of the user (per-user eBay auth), reuse existing auth patterns (check `better-auth` usage in package.json) and persist tokens securely.

7. Data flows (sequence)
   - Server-driven flow: web app requests extension to scrape Poshmark active listing → extension scrapes and sends `POSHMARK_ACTIVE_DATA` to web app → web app POSTs to server `/create-ebay-listing` (images as form-data) → server calls eBay API → server persists `ebayItemId` and responds → UI updates.
   - The extension does not automate eBay listing creation; it only handles Poshmark scraping and metadata delivery.

8. Tests and QA
   - Unit tests for new server endpoints (validate payloads, mock eBay API responses).
   - End-to-end manual tests with extension + local dev site. Add a dev-mode guide for running the extension locally (manifest host permissions already include `http://localhost:5173/*`).

## Files to Modify / Create (high level)
- Modify: `src/routes/auth/active-items/+page.svelte` — add Import UI, confirmation modal, and handlers.
- Modify/Create: `src/routes/auth/poshmark/` endpoints — `create-ebay-listing` and `import-active` server routes.
- Modify: `src/lib/server/DatabaseUtils.js` and related Mongoose models to add `crosslisted` metadata.
- Modify: `xlister-chrome-extension/poshmark.js`, `background.js`, `forwarder.js` — new message handlers and scraping logic.
- Create: `cypress` or integration test scaffolding (optional).

## Implementation Estimates
- Design & wireframes: 0.5 day
- Extension scraping changes + basic tests: 2–3 days
- Server API + DB updates + tests: 2–3 days
- UI changes + integration: 1–2 days
- QA + edge-case fixes: 1–2 days
Total: ~1–2 weeks (depending on availability, eBay auth complexity, and robust image handling).

## Next Steps (choose one)
- I can draft the exact code changes for step 1: add the `Import from Poshmark` button and client handlers in `src/routes/auth/active-items/+page.svelte`.
- Or I can prototype the extension `poshmark.js` scraper for active listings (single-listing scrape).
- Or I can draft the server endpoint for creating eBay listings and the DB schema changes.

Please pick which of the above to start implementing, or say "Create full task plan and assign estimates" to expand this into a ticket list.