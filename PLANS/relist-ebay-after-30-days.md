# Relist eBay Items After 30 Days

Status: Research complete — implementation deferred until approval.

## Summary
Add a per-item option allowing users to automatically relist an eBay item every 30 days. This feature is eBay-only and is not part of the Poshmark listing flow. It includes a UI toggle (checkbox) in the existing eBay listing controls, storage of relist metadata in the existing eBay item metadata model, and a daily serverless job that processes items due for relist and performs the relist operation via eBay APIs.

Important invariant: the original listing date must be preserved across every relist. The app should retain the item’s first ever listing date as its historical origin date even when a new relist creates a fresh eBay listing. A relist should schedule a new listing cycle without overwriting the original listing date used for reporting, analytics, and customer-facing history.

Scope note: the relist automation described here applies only to eBay active items. Poshmark item workflows remain unchanged and do not receive the relist checkbox or relist scheduling.

This document contains researched options for relisting on eBay, recommended approach, data model and UI design, server-side scheduler design (Vercel-friendly), token and rate-limit considerations, observability and error handling, testing suggestions, and rollout plan.

## Implementation phases

1. UI update: add the `Relist` submenu to the eBay per-item ellipsis menu and place the checkbox inside it. The checkbox must be labeled `Relist every 30 days` and should read the stored metadata value to show whether auto-relist is enabled. This is limited to the eBay active-items page and does not affect Poshmark items.
2. Frontend event handling: when the checkbox changes, the eBay frontend should call the existing metadata update flow, sending the item ID and relist fields such as `relistEnabled`, `relistAt`, and `relistIntervalDays` in the payload.
3. Backend accept event: create or extend the eBay metadata update endpoint so it accepts the checkbox change and validates the item ownership before updating the DB record.
4. Backend DB persistence: persist the relist fields to the eBay item metadata record. Save `relistEnabled`, `relistAt`, and the default `relistIntervalDays`, and ensure the item record remains synced with the latest listing metadata and the original listing date is preserved.
5. Delist + relist workflow: implement the backend logic that scans eBay items for records where `relistEnabled = true` and `relistAt <= now`, then performs the delist flow first. The item must end its active eBay listing before it is moved to the inactive list, and only after it is inactive may the code relist it. The relist should reuse the active tokens for the user, update the eBay listing ID in the database, and schedule the next `relistAt` value. Confirm the API contract to do this, likely via a server route such as `POST /api/relist-due` or a dedicated internal function called by that route.
6. Vercel scheduler: configure the daily Vercel cron job to invoke the relist check endpoint once per day. The job should call the same backend relist/delist logic used in manual execution and log success/failure counts so we can verify that items are actually being processed.

## Implementation details by phase

### Phase 1: UI update — add menu and checkbox
Code changes:
- Update the per-item dropdown menu component used on active listings, likely in `src/components/...` or the active-items page in `src/routes/auth/active-items/+page.svelte`.
- Add a new submenu titled `Relist` under the existing item action menu.
- Add a checkbox field with label `Relist every 30 days` and `checked={item.meta.relistEnabled}`.
- Ensure the checkbox is disabled only when the item is not in a valid active state or the user does not own the listing.
- Reuse current item metadata payloads rather than adding a separate ad hoc state model.

Implementation notes:
- Keep the UI change minimal and consistent with the existing `Dropdown.svelte` / `CrosslistMenu.svelte` patterns.
- Default checkbox state is unchecked until the user enables auto-relist.
- When enabled, the UI should show a toast or inline confirmation like `Auto-relist enabled — next relist in 30 days`.

### Phase 2: Frontend code — react to checkbox and send event
Code changes:
- Add a `handleRelistToggle` function in the listing item component or page-level handler.
- On checkbox change, capture `item._id` and the desired values:
  - `relistEnabled`
  - `relistIntervalDays = 30`
  - `relistAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()`
- Submit through the existing metadata update flow, e.g. `postMetaData()` or `actions.updateItem()`.
- Avoid using a custom frontend-only state store for the relist toggle; always persist through the metadata API so the server is the source of truth.

Expected payload example:
```ts
{
  itemId: item._id,
  relistEnabled: true,
  relistIntervalDays: 30,
  relistAt: "2026-10-22T00:00:00.000Z"
}
```

### Phase 3: Backend accept event — handle checkbox save request
Code changes:
- Extend the item metadata endpoint in the server routes layer, likely under `src/routes/api/...` or the equivalent metadata handler used by `postMetaData()`.
- Validate that the user owns the item before accepting the relist update.
- Accept the incoming payload fields:
  - `relistEnabled`
  - `relistAt`
  - `relistIntervalDays`
- Return success/failure with explicit validation errors if the payload is invalid.
- Ensure the API is idempotent for repeated checkbox toggles from the UI.

Server-side validation rules:
- `relistIntervalDays` must be a positive integer.
- `relistAt` should be stored in UTC.
- When turning the checkbox off, set `relistEnabled = false` and clear `relistAt`.

### Phase 4: Backend DB persistence — write relist state to item metadata
Code changes:
- Update the metadata model in `src/lib/server/models/ebay-item-metadata.ts` (or the relevant schema file) to include:
  - `originalListedAt: Date | null`
  - `currentListedAt: Date | null`
  - `ebayListingId: string | null`
  - `relistEnabled: boolean`
  - `relistAt: Date | null`
  - `relistIntervalDays: number`
  - `lastRelistAttemptAt?: Date`
  - `lastRelistResult?: string`
  - `relistAttemptCount?: number`
- Update `DatabaseUtils` with helper methods such as:
  - `updateRelistSettings(itemId, data)`
  - `getItemsDueForRelist(now, limit)`
  - `markRelistSuccess(itemId, result)`
  - `markRelistFailure(itemId, error)`
- Ensure `originalListedAt` is set once and never overwritten across relists.
- Ensure `ebayListingId` is replaced after a successful relist while preserving the original listing date.

### Phase 5: Delist + relist workflow — scan, end listing, relist, update DB
Code changes:
- Add a backend service module such as `src/lib/server/ebayUtils.ts` (or expand the existing eBay utility file) with:
  - `relistDueItems()`
  - `endListing()`
  - `relistItem()`
  - `processRelistCycle(item)`
- Add the cron-facing route `POST /api/relist-due` or equivalent internal trigger endpoint.
- The route should:
  1. authenticate the request
  2. fetch due items with `getItemsDueForRelist(now, limit)`
  3. group by user and token set
  4. for each item: end the active listing first, confirm the item is inactive, then relist it
  5. update `ebayListingId`, `currentListedAt`, `relistAt`, and `lastRelistResult`
  6. return counts for processed, succeeded, failed, and skipped items
- Require the delist action to complete before relisting. If the item is still active, do not relist until the follow-up inactive state is confirmed.
- The workflow should only relist items where `relistEnabled = true` and `relistAt <= now`.

Pseudo-flow:
```ts
const dueItems = await DatabaseUtils.getItemsDueForRelist(new Date(), 50);
for (const item of dueItems) {
  const tokens = await getEbayTokensForUser(item.userId);
  await ebayUtils.endListing(item, tokens);
  await ebayUtils.relistItem(item, tokens);
  await DatabaseUtils.updateRelistSuccess(item._id, new Date(), {
    ebayListingId: newId,
    currentListedAt: new Date()
  });
}
```

### Phase 6: Vercel job — run once per day
Code changes:
- Configure a Vercel cron or equivalent scheduled job that calls the relist API once per day.
- Add a route such as `src/routes/api/relist-due/+server.ts` that calls the common processing function used by manual runs.
- Include logging for:
  - job start time
  - items scanned
  - items relisted
  - failures
  - skipped items
- Protect the endpoint with a secret or internal verification token so only the scheduler can trigger it.
- Add a dry-run mode for testing, e.g. `POST /api/relist-due?dry=true`, which lists due items without executing the delist/relist cycle.

Operational requirement:
- The cron job should invoke the same code path that the UI and admin tooling use, so there is one canonical relist executor and no divergence between manual and scheduled processing.

---

## eBay relist options (research)

There are two common ways to "relist" an item on eBay depending on the listing lifecycle and the available APIs for your integration:

1. Trading API: RelistItem
- The legacy Trading API provides `RelistItem`, which relists a previously ended item while attempting to preserve much of the original listing (item specifics, images, category, etc.). This is suitable when you previously had a listing that ended and you want to relist the same listing ID or closely preserve the original.
- Pros: preserves many original fields, simpler to call when eligible.
- Cons: Trading API credentials/scopes and account access requirements may differ; some accounts (or listing types) may not be eligible; eBay is moving developers toward Sell APIs.

2. Sell APIs (Inventory / Offer / Listing): Create a new listing
- The modern Sell APIs use an inventory/offer flow where you create or reuse inventory items, create an offer, and publish it to marketplace.
- To "relist" with Sell APIs you often need to recreate the listing data (or reuse inventory records if you stored them) and create a new offer/listing.
- Pros: supported direction by eBay going forward; more control and modern RESTful semantics.
- Cons: requires more work to gather original listing data (images, specifics, shipping, price), and may result in a different listing ID.

Recommendation: implement a hybrid approach in `ebayUtils.relistItem()`:
- Prefer Trading API `RelistItem` when the original listing is eligible and account tokens/scopes allow it.
- Fall back to rebuilding the listing via the Sell APIs (Inventory/Offer) when `RelistItem` is not applicable or fails due to eligibility/policy reasons.

Notes:
- Auction vs Fixed Price: relist behavior differs for auction listings; choose behavior depending on listing type.
- Images: ensure you have stored links or the ability to re-upload images; older listings may reference hosted-image IDs that have expired.

---

## Data model changes (persisting relist state)

Extend the existing eBay metadata schema (see `src/lib/server/models/ebay-item-metadata.ts` and `src/lib/server/DatabaseUtils.ts`) with the following fields:

- `originalListedAt: Date | null` — the first-ever listing date for this item; this value must never change across relists.
- `currentListedAt: Date | null` — the most recent listing start date for the active listing cycle, if applicable.
- `ebayListingId: string | null` — the current live eBay listing ID; this must be updated whenever a relist creates a new listing.
- `relistEnabled: boolean` — whether automatic relist is enabled (default: false).
- `relistAt: Date | null` — the absolute UTC timestamp when the next relist should run.
- `relistIntervalDays: number` — default 30 (allows future configurability).
- `lastRelistAttemptAt?: Date` — timestamp of last attempt for observability.
- `lastRelistResult?: string` — short result string (success/failure description).
- `relistAttemptCount?: number` — optional, for backoff and disabling after N failures.

Behavior when user enables checkbox:
- Set `relistEnabled = true` and `relistAt = now + relistIntervalDays` (use 30 days by default).
- If `originalListedAt` is null, set it when the listing is first created from the original sell event.
- If user disables checkbox: set `relistEnabled = false` and `relistAt = null`.
- After a successful relist, set `ebayListingId` to the new eBay listing ID returned by eBay, update `currentListedAt = now`, and keep `originalListedAt` unchanged.
- After a successful relist, also set `relistAt = now + relistIntervalDays` (schedule next run).
- After a failed attempt, increment `relistAttemptCount`, set `lastRelistAttemptAt`, set `lastRelistResult`, and optionally back off or disable after a threshold.

Security & data: store dates in UTC. Use existing DB connection patterns in `DatabaseUtils` to persist changes. The original listing date is a fixed historical value, not a field that should be overwritten by any subsequent relist. The current eBay listing ID is a live sync field that must be replaced on every successful relist so the app uses the newest listing for future updates and status checks.

---

## UI design (placement & behavior)

Where to add the control:
- Add a dedicated `Relist` submenu in the existing per-listing ellipsis menu (the "..." menu). Inside that submenu, add a checkbox labeled "Relist every 30 days". This keeps the relist setting grouped with other item-specific actions and matches the existing menu patterns in `Dropdown.svelte` and `CrosslistMenu.svelte`.

UX details:
- Menu name: `Relist`.
- Checkbox label: "Relist every 30 days" (or toggle text: "Auto-relist (30 days)").
- On enable: show a confirmation/toast "Auto-relist enabled — next relist in 30 days".
- On the listing row, show a small badge or text when enabled: e.g. "Relist in X days". Compute as `ceil((relistAt - now) / 1 day)` for display.
- Allow users to optionally set a custom date in future (not required in MVP).

Implementation notes:
- Reuse existing metadata save flow (`postMetaData()` / `actions.updateItem`) so toggling the control updates the DB.
- The checkbox should emit a change event only when the user toggles it; the handler will send the current item ID plus the relist fields to the existing metadata update endpoint.
- Server contract for the checkbox sync: `POST /api/items/:id/meta` (or the current equivalent metadata endpoint) receives a payload like `{ itemId, relistEnabled: true, relistAt: "2026-10-22T00:00:00.000Z", relistIntervalDays: 30 }` and persists it to the item metadata record.
- When the checkbox is turned on: compute `relistAt = now + 30 days`, set `relistEnabled = true`, and write the result to the DB.
- When the checkbox is turned off: set `relistEnabled = false`, clear `relistAt`, and save the metadata update.
- Avoid heavy UI changes: minimal visual addition to `src/routes/auth/active-items/+page.svelte` (and any similar item lists).

Accessibility:
- Ensure checkbox has proper labels and tooltips explaining behavior.

### Checkbox-to-server sync flow
1. User opens the item ellipsis menu and selects the `Relist` submenu.
2. The checkbox is rendered with the current value from the stored metadata (`relistEnabled`).
3. On change, the UI calls the same metadata updater used by the rest of the app; this is not a standalone API call, but the existing save path for item metadata.
4. The server validates the item ownership and updates the metadata document with `relistEnabled`, `relistAt`, and `relistIntervalDays` in UTC.
5. The app refreshes the row state from the persisted record so the badge and countdown reflect the saved settings.
6. Any future scheduler run reads the updated metadata and uses the new `relistAt` value to decide whether the item is due for relist.

---

## Server-side scheduler design

Constraints:
- App is deployed on Vercel (serverless). No persistent worker is available by default.
- Need a daily job to find items where `relistEnabled = true` and `relistAt <= now` and perform relist operations.

Recommended approach (Vercel-friendly):
1. Create a serverless endpoint `POST /api/relist-due` (e.g., `src/routes/api/relist-due/+server.ts`) that:
   - Authenticates (internal secret or verification) to prevent public abuse.
   - Queries DB for due items (use a new helper `getItemsDueForRelist(now, limit)` in `DatabaseUtils`).
   - Processes items in batches grouped by user to use tokens per user and to respect per-user rate limits.
   - For each item, call `ebayUtils.relistItem()` using the correct user tokens.
   - Update metadata for success/failure as described above.
   - Return a summary (counts processed, success/failure) in the response and write logs.

2. Schedule the endpoint to run daily using one of:
   - Vercel Cron (Serverless Scheduled Functions) — preferred when using Vercel.
   - GitHub Actions cron that invokes the endpoint daily.
   - An external cron service or cloud scheduler.

3. Rate-limiting and batching:
   - Process N items per user per run (configurable; e.g., 10–50) to avoid hitting eBay rate limits.
   - Implement exponential backoff and respect eBay API rate-limit headers.
   - Optional: add a queueing system (e.g., Redis + worker) if relist volume grows, but start with serverless batches.

Security:
- Protect the endpoint with a Vercel Environment variable secret or similar; only trusted scheduler must call it.

Idempotency & retries:
- Mark items as "in-flight" (e.g., set `relistAttemptLockAt` or similar) to avoid double-processing across concurrent runs.
- Requeue or leave failed items with `relistAttemptCount` incremented; disable after N failures.

---

## eBay API implementation details

Suggested helper: `relistItem(metadata, tokens, options)` in `src/lib/server/ebayUtils.ts`

Behavior:
1. Validate tokens: use existing `getEbayTokensFromDB()` and refresh via `refreshEbayToken()` if necessary.
2. If original listing is eligible for Trading API `RelistItem`, attempt `RelistItem`:
   - Prepare required fields; ensure you include `ItemID`/original identifiers.
   - Handle specific Trading API requirements (site ID, listing type, fees, variations).
3. If `RelistItem` is not available or fails due to eligibility, gather listing details and create a new listing via Sell APIs:
   - Create or reuse InventoryItem with the same item specifics and images.
   - Create an Offer for the marketplace with desired price and shipping.
   - Publish the Offer to create a new listing.
4. On success, update metadata with the new eBay listing ID (`ebayListingId`), keep `originalListedAt` unchanged, set `currentListedAt` to the new listing date, and schedule the next `relistAt`.
5. On failure, update `lastRelistResult`, possibly disable after repeated failures.

Edge cases:
- Item sold in the meantime: do not relist; log and optionally disable auto-relist.
- Listing policy restrictions: surface error to admin and mark disabled if permanent.
- Images: ensure upload/host compliance if old image references are expired.

---

## Token & auth handling

- Use existing patterns in `hooks.server.ts` and `DatabaseUtils` to get per-user eBay tokens and refresh them.
- The relist job must operate with per-user tokens (iterate users with `relistEnabled` items and valid tokens).
- When tokens are expired and cannot be refreshed, mark item as failed and notify the user to reconnect.

---

## Observability & failure handling

- Add metadata fields `lastRelistAttemptAt`, `lastRelistResult`, and `relistAttemptCount`.
- Log relist job runs (time started, items processed, successes, failures) to standard logs; consider sending admin email or Slack notifications for wide failures.
- Add an admin endpoint to view recent relist job summaries and individual item relist status.
- Add a dry-run mode `?dry=true` to `POST /api/relist-due` that lists items that would be relisted without calling eBay.

---

## Testing & rollout

1. Unit tests: DB helper `getItemsDueForRelist`, `relistAt` computation, and `relistItem()` unit tests using mocked eBay responses.
2. Integration: run the serverless endpoint in dry-run mode against staging DB and review the candidate items.
3. Staging run: run the endpoint with a sandbox eBay account or a test real account; verify listings on eBay.
4. Canary rollout: enable auto-relist for a small set of power users or internal accounts for 1–2 weeks.
5. Full rollout: enable across users; configure monitoring and a rollback plan.

---

## Rollout timeline (example)

- Week 1: Add DB fields and UI checkbox (feature flag off), create PLANS doc (this document).
- Week 2: Scaffold `relist-due` endpoint (dry-run), implement `getItemsDueForRelist()`.
- Week 3: Implement `relistItem()` Trading API branch; test in staging.
- Week 4: Implement Sell API fallback and full end-to-end staging test.
- Week 5: Canary rollout and monitoring.

---

## Security & privacy considerations

- Never store eBay OAuth refresh tokens in logs.
- Protect the serverless job endpoint with a secret and limit requests by origin.
- Add rate limiting/guards to prevent accidental mass relisting.

---

## Recommended next steps (prioritized)

1. Add DB schema fields and migration if necessary.
2. Add UI checkbox and display in the `...` menu and listing rows; persist via existing metadata endpoint.
3. Create `POST /api/relist-due` (dry-run) and `DatabaseUtils.getItemsDueForRelist()`.
4. Implement `ebayUtils.relistItem()` first with Trading API `RelistItem` and a stubbed Sell API fallback.
5. Configure Vercel Cron to call the endpoint daily (or use GitHub Actions cron for initial testing).

---

## Appendix: Example serverless endpoint pseudocode

```ts
// POST /api/relist-due
// pseudo
export async function POST({ request }) {
  // verify secret
  const now = new Date();
  const items = await DatabaseUtils.getItemsDueForRelist(now, { limitPerUser: 20 });
  for (const group of groupByUser(items)) {
    const tokens = await getEbayTokensForUser(group.userId);
    if (!tokens) { markFailureForGroup(group, "no_tokens"); continue; }
    for (const item of group.items) {
      try {
        const relistResult = await ebayUtils.relistItem(item.metadata, tokens);
        await DatabaseUtils.updateRelistSuccess(item.id, new Date(), {
          ebayListingId: relistResult.newListingId,
          currentListedAt: relistResult.listedAt ?? new Date()
        });
      } catch (err) {
        await DatabaseUtils.updateRelistFailure(item.id, err.message);
      }
    }
  }
  return new Response(JSON.stringify({ processed: items.length }), { status: 200 });
}
```

---

## Contacts & references
- eBay Trading API `RelistItem` docs: https://developer.ebay.com/devzone/xml/docs/reference/ebay/RelistItem.html
- eBay Sell APIs docs (Inventory, Offer): https://developer.ebay.com/api-docs/sell/static/overview



---

File created: PLANS/relist-ebay-after-30-days.md
