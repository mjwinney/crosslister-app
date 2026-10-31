# Relist Auto-Discount: Implementation Plan

Status: all phases implemented and covered by tests (`npm test`).

## Goal

Add a "Discount on relist" option to the Relist submenu on the eBay active-items page. On each 30-day relist the price drops by a whole-number percentage, up to a maximum total discount. The settings are persisted in the eBay item metadata in MongoDB.

## Requirements

- Two fields: discount % (default 5) and maximum % (default 20), plus an enable checkbox.
- While the checkbox is enabled, the values are locked. Disabling the checkbox unlocks them.
- Both values are whole numbers only. Digits only in the UI; integers enforced on the server.
- Rule: `discount > 0`, `discount < max`, `discount <= 50` and `max <= 50`. There is no "max must be a multiple of discount" rule.
- Neither the discount nor the maximum can ever exceed 50%. This is enforced in the UI, the validator, the server action and `relistEbayItemsWithPriceChange`.
- If the rule is violated, enabling is rejected with an error and the checkbox stays unchecked.
- The two inputs are also validated when the user leaves a field (blur), so the error appears before the checkbox is ticked.
- The discount keeps applying until the price reaches the floor, which is the maximum discount taken off the original price. Each relist takes the discount % off the current price, so the amount shrinks as the price drops. The final relist is clamped so the price ends exactly at the floor. Example: 10% discount with a 15% maximum on a base of 100 gives 90, then 85 (not 81), then stays at 85.
- The discount only applies when "Relist every 30 days" is also enabled. Poshmark is excluded.

## UI mockups

Relist submenu with the new option.

Discount off (default values, editable):

```
Relist  >  +--------------------------------------+
           | [ ] Relist every 30 days             |
           |--------------------------------------|
           | [ ] Discount on relist               |
           |     Discount %   [  5 ]              |
           |     Maximum %    [ 20 ]              |
           +--------------------------------------+
```

Discount on (inputs locked):

```
Relist  >  +--------------------------------------+
           | [x] Relist every 30 days             |
           |--------------------------------------|
           | [x] Discount on relist               |
           |     Discount %   [ 5  ]  (locked)    |
           |     Maximum %    [ 20 ]  (locked)    |
           +--------------------------------------+
```

Invalid values (enabling is rejected, checkbox stays unchecked). A warning icon appears at the start of both labels, and hovering it shows the error in a tooltip above the icon. The icon slot is always reserved, so the menu width never changes:

```
Relist  >  +--------------------------------------+
           | [x] Relist every 30 days             |
           |--------------------------------------|
           | [ ] Discount on relist               |
           |     (!) Discount %   [ 20 ]          |
           |     (!) Maximum %    [ 10 ]          |
           +--------------------------------------+

              +------------------------------+
              | Discount must be less than max |   <- tooltip on hover of (!)
              +--v---------------------------+
```

## Price-floor design

Each relist takes the discount % off the current price, so the amount discounted gets smaller as the price falls. The price can never go below a floor set by the maximum discount applied to the original price.

- `relistDiscountBasePrice`: the price the floor is anchored to. It is captured from the live eBay price at the first discounted relist after enabling, and reset to the live price whenever the price was changed manually (see below).
- `relistDiscountLastPrice`: the price this feature set at the last successful relist. Used only to detect a manual price edit.
- Floor price: `round(base * (1 - max / 100), 2)`.
- Before each discounted relist: if `base` is empty, or the live price differs from `lastPrice`, set `base` to the live price. A manual edit therefore resets the floor to the edited price, and the discount continues from there.
- New price: `max(round(current * (1 - discount / 100), 2), floor)`, where `current` is the live eBay price at relist time.
- Once the price is at the floor, relists keep the floor price. The last step is clamped, so the price ends exactly at the floor.
- After a successful relist, save the new price as `lastPrice`.
- No step counter is needed: the price itself shows where it is, and the floor stops it. A failed or retried cron run cannot double-discount, because the live price only changes when a relist succeeds.
- Enabling the discount clears `base` and `lastPrice`, so disabling then re-enabling captures the current price as the new base.

Why not take the discount off the original price each time: that would remove the same dollar amount on every relist. The chosen rule takes a percentage of the current price, so the dollar amount shrinks, and the floor enforces the maximum.

Why a base price is still stored: the live price keeps falling, so the original price must be remembered to compute the floor. A stored last price tells us whether the user changed the price by hand.

### Worked examples (base 100)

Prices are rounded to 2 decimals at every step.

| Discount / Max | Floor | Relist 1 | Relist 2 | Relist 3 | Relist 4 | Relist 5 | Relist 6 |
| -------------- | ----- | -------- | -------- | -------- | -------- | -------- | -------- |
| 5 / 20         | 80    | 95.00    | 90.25    | 85.74    | 81.45    | 80.00    | 80.00    |
| 10 / 15        | 85    | 90.00    | 85.00    | 85.00    | 85.00    | 85.00    | 85.00    |

How the rows work:

- 5 / 20: 95.00 x 0.95 = 90.25, then 90.25 x 0.95 = 85.7375 (85.74), then 85.74 x 0.95 = 81.453 (81.45). Next, 81.45 x 0.95 = 77.3775 is below the floor, so it is clamped to 80.00. After that, 80.00 x 0.95 = 76.00 is again below the floor, so it stays at 80.00.
- 10 / 15: 90.00, then 90.00 x 0.90 = 81.00 is below the floor, so it is clamped to 85.00 and stays there.

## Existing code involved

| Area                        | File                                                          |
| --------------------------- | ------------------------------------------------------------- |
| Mongo schema                | `src/lib/server/models/ebay-item-metadata.ts`                 |
| Metadata type and DB helpers| `src/lib/server/DatabaseUtils.ts`                             |
| Relist with price change    | `src/lib/server/ebayUtils.ts` (`relistEbayItemsWithPriceChange`) |
| Daily cron route            | `src/routes/api/relist-due/+server.ts`                        |
| Metadata save action        | `src/routes/auth/active-items/+page.server.ts` (`updateItem`) |
| Relist submenu UI           | `src/routes/auth/active-items/+page.svelte`                   |

Notes from the current code:

- `relistEbayItemsWithPriceChange` used to accept a signed percentage (increase or decrease) with a +/-50% limit. It now accepts a discount only (see Phase 4).
- `relist-due/+server.ts` used to call it with a price change of 0. It now passes the item's discount settings.
- `replaceEbayItemId` moves metadata to the new item ID after a relist. It must keep the discount fields.

## Implementation steps

### Phase 1: Data model (done)

1. Add to the schema: `relistDiscountEnabled` (false), `relistDiscountPercent` (5), `relistDiscountMaxPercent` (20), `relistDiscountBasePrice`, `relistDiscountLastPrice`.
2. Add the same fields to `MetaDataModel` and to the read mappings in `DatabaseUtils.ts`.
3. Confirm `replaceEbayItemId` preserves the fields.

### Phase 2: Validation (done)

`src/lib/relistDiscount.ts` has `validateRelistDiscount`, `getRelistDiscountFieldErrors`, `nextDiscountPrice`, `prepareRelistDiscountUpdate`, `MAX_DISCOUNT_PERCENT` and the two default constants.

4. Create a shared validator in `src/lib/relistDiscount.ts`, with no server imports so the browser can use it. Exports:
   - `validateRelistDiscount(discount, max)`: both must be integers, `discount > 0`, `discount < max`, `discount <= 50`, `max <= 50`. Export the limit as a `MAX_DISCOUNT_PERCENT = 50` constant shared by the UI, server and eBay helper.
   - `nextDiscountPrice(current, base, discount, max)`: returns `max(round(current * (1 - discount / 100), 2), round(base * (1 - max / 100), 2))`.
5. The `updateItem` action calls `prepareRelistDiscountUpdate(incoming, existingRecord)` after the ownership check:
   - When `relistDiscountEnabled` is true, the pair is validated and a 400 is returned on failure.
   - Newly enabling the discount sets the base and last prices to null.
   - Changing the percentages while the discount stays enabled returns a 400.
   - Switching the discount off clears the base and last prices.
   - The base and last prices sent by the client are always dropped. They belong to the relist job, and the page sends stale copies with every metadata save, which would otherwise make the next relist look like a manual price edit.
   - The action's existing-record lookup goes straight to the Mongoose model, so it relies on the connection the app's request hook already opens. The tests open it themselves in `beforeAll`.
   - Identity: the owner is taken from `locals.session.userId` (401 when signed out). A `userId` in the form is ignored, and the page no longer sends one. `itemId`, `userId`, `_id` and `createdAt` are stripped from the metadata so a client cannot reassign a record. The same pattern still exists in other routes (see the end of this document).
### Phase 3: UI (done)

6. In the Relist submenu add a "Discount on relist" checkbox with two numeric inputs (step 1, min 1, max 50, digits only). Inputs are disabled while the checkbox is on. Values above 50 are rejected with an inline error. Implemented as text inputs that strip non-digits and allow two characters at most, with the typed text kept per item so a field can be cleared and retyped.
7. Add a handler next to `handleRelistToggle` that validates first. On failure, leave the checkbox unchecked and show an inline error. Persist through `postMetaData`. Implemented as `handleDiscountToggle`. On enable it also sends the base and last prices as null.
8. Validate the discount and maximum as a pair when either input loses focus (`handleDiscountBlur`), showing or clearing the same error on both labels as a warning icon with a hover tooltip (no text below the inputs, so the menu does not resize). Blur only validates; values are saved when the checkbox is enabled.

### Phase 4: Relist logic (done)

9. `relistEbayItemsWithPriceChange` is now `(locals, itemId, discountPercent, discount?)`, where `discount` is `{ maxPercent, basePrice?, lastPrice? }`. The floor is computed inside the method rather than passed in, because the method already fetches the live price and this avoids a second eBay call:
   - `discountPercent` is a discount only: a whole number from 0 to 50. Negative values (price increases), values above 50 and non-integers return a 400. With `discount`, the pair is also checked by `validateRelistDiscount`.
   - `0` means relist at the unchanged price, which the plain 30-day relist still needs.
   - With `discount`: if `basePrice` or `lastPrice` is empty, or the live price differs from `lastPrice` (manual edit), the base is reset to the live price. The new price is `nextDiscountPrice(live, base, discountPercent, maxPercent)`.
   - Without `discount` and `discountPercent > 0`, the price is simply discounted from the live price (used by the test action).
   - The result data now includes `newPrice` and `basePrice`.
10. `relist-due/+server.ts` passes the discount settings when `relistDiscountEnabled` is true. If the stored percent and max are invalid, the item is skipped with the result `invalid relist discount settings` instead of relisting at an unintended price. After a successful relist it saves `relistDiscountBasePrice` and `relistDiscountLastPrice` (the new price) with the existing success update. At the floor the relist still happens, at the unchanged price.
11. The test action `relistEbayItemsWithPriceChange` in `+page.server.ts` now passes `10` (a 10% discount) instead of `-10`.

Checked by running `nextDiscountPrice` repeatedly from a base of 100: 5/20 gives 95, 90.25, 85.74, 81.45, 80, 80; 10/15 gives 90, 85, 85; 3/7 gives 97, 94.09, 93, 93.

## Testing

### Framework

Vitest with `mongodb-memory-server` (a real in-process MongoDB). Setup:

- `vite.config.ts` has a `test` block: node environment, `src/**/*.test.ts`, and aliases for `$env/static/private` and `$env/dynamic/private` that point at stubs in `src/test/`. The stubs mean tests can never read `.env` or reach the real database; without a running test server the Mongo URI is an unreachable address.
- `src/test/mongo.ts` has `startTestMongo`, `clearTestMongo` and `stopTestMongo`. `startTestMongo()` is awaited at the top of a test file before `DatabaseUtils` is imported, because it reads the URI at import time.
- `package.json` scripts: `npm test` (run once) and `npm run test:watch`.
- The first run downloads a MongoDB binary.

### Test files

| File | Covers |
| ---- | ------ |
| `src/lib/relistDiscount.test.ts` | Validator, per-field errors, `nextDiscountPrice` sequences, `prepareRelistDiscountUpdate` |
| `src/lib/server/DatabaseUtils.test.ts` | Mongo integration: upsert and defaults, `originalListedAt`, due-item reads, `getEbayMetadata`, `replaceEbayItemId`, `markRelistSuccess` and `markRelistFailure` |
| `src/lib/server/ebayUtils.relist.test.ts` | `relistEbayItemsWithPriceChange` with `fetch` mocked: validation, the floor, manual-edit reset |
| `src/routes/auth/active-items/updateItem.test.ts` | The `updateItem` action against the in-memory database |
| `src/routes/api/relist-due/server.test.ts` | The cron route with the eBay relist helper mocked and the real database helpers |

To check the tests catch regressions, the `discount >= max` rule and the floor clamp in `nextDiscountPrice` were each broken on purpose, and tests failed in both cases.

### What the planned tests cover

#### Validator unit tests

- Valid: 5/20, 10/15, 1/2.
- Valid at the limit: 49/50.
- Invalid: 15/15, 50/50, 20/10, 0/10, negatives, 2.5/20, 5/20.5, "abc", empty, null, `NaN`, 5/51, 51/60, 5/100.
- `relistEbayItemsWithPriceChange`: rejects -1, 51 and non-integers; accepts 0 and 50; the price never goes below the floor passed in.
- Pricing, base 100, 10/15: 90, 85, 85.
- Pricing, base 100, 5/20: 95, 90.25, 85.74, 81.45, 80, 80.
- Rounding to 2 decimals at every step.

#### Mongo integration tests

Mongo can be exercised without a real database by using `mongodb-memory-server`, which runs a real in-process MongoDB. This is preferred over mocking Mongoose because real queries, `$set`, upserts and the unique index are exercised.

Points to handle:

- `DatabaseUtils.ts` imports `MONGODB_URI` from `$env/static/private`, so the test config must alias that module.
- `connectToDatabase` caches the connection in a module-level `cachedDb`. Connect once in `beforeAll`, clear collections in `afterEach`, disconnect in `afterAll`.
- The first run downloads a MongoDB binary.
- Tests that would call eBay should mock `fetch`.

Test cases:

- `updateEbayMetadata` upserts and persists the discount fields.
- `originalListedAt` is preserved.
- `getDueRelistGroupsByUser` returns the discount fields.
- `replaceEbayItemId` keeps the discount fields on the new row.
- `updateItem` action: invalid discount returns 400, enabling clears the base and last prices, another user's item returns 403.
- `relist-due` route with `relistEbayItemsWithPriceChange` mocked: unauthorized returns 401, the base price is captured once, the price stops at the floor, and a manual price edit (live price differs from the last price) resets the base to the live price.

### Running the tests

Vercel builds must not run the tests: keep the build command as `vite build` and add no `prebuild` or `postbuild` test hook.

Choose one of the options below, or combine them.

**Decision: Option A (local only) for now.** Option B is kept below for reference and is not being set up.

**Option A: Local only (no GitHub login needed)**

- Run `npm test` after each code change, or keep `npm run test:watch` running in a terminal while developing. Results appear in the terminal.
- Optional safety net: a husky `pre-push` hook that runs `npm test`, so a push is blocked locally if a test fails. It only affects local pushes and has no effect on Vercel.
- Trade-off: it depends on you remembering to run the tests, and nothing runs if the hook is skipped.

**Option B: GitHub Actions CI**

A workflow in `.github/workflows/ci.yml` that runs on every push and pull request:

1. Check out the repo.
2. Install Node and run `npm ci`.
3. Restore the cached MongoDB binary used by `mongodb-memory-server`.
4. Run `npm run check` (svelte-check and TypeScript).
5. Run `npm test`.
6. Report pass or fail on the commit or pull request.

- Results are viewed on GitHub, in the Actions tab or on the pull request.
- To block merging on failures, enable branch protection on `main` and mark the CI check as required.
- Trade-off: it needs a GitHub login to see results, though GitHub can also email on failure.

**Current preference:** Option A for now. Option B can be added later without changing the tests.

## Verification

1. `npm test` passes locally and fails when a validator rule is deliberately broken.
2. The integration tests pass with no real `MONGODB_URI` set.
3. Run the cron route on a test item and confirm the price, base price and `relistAt` update in Mongo.
4. In the UI, confirm inputs lock while the checkbox is on and an invalid pair blocks enabling.

## Scope

In scope: eBay only, whole-number percentages, validator and Mongo integration tests.

Out of scope: Svelte component tests, a minimum-dollar floor, GitHub Actions CI (local tests only for now), changes to the existing title suffix. The old +/-50% safety limit becomes a 0 to 50% discount-only limit.

## Decisions

1. Disabling then re-enabling the discount captures the current price as the new base.
2. A manual eBay price edit between relists resets the floor to the edited (current) price. This is detected by comparing the live price with the last price the feature set.
3. Tests are run locally only for now. GitHub Actions CI is not set up.

## Related security fix

Every metadata `updateItem` action used to read `userId` from the submitted form, so a signed-in user could write to another user's records. All five now go through `readMetadataRequest` in `src/lib/server/metadataRequest.ts`: the owner comes from `locals.session.userId` (401 when signed out), a form `userId` is ignored, `itemId`, `userId`, `_id` and `createdAt` are stripped from the metadata, and non-object metadata returns a 400. The actions are in `active-items`, `sold-items`, `scheduled-items`, `poshmark-sold-items` and `poshmark-active-items` (`+page.server.ts` in each), and the pages no longer send a `userId`. Failures now use `fail()` instead of returning a `Response`. Tests are in `src/routes/auth/metadataActions.test.ts` and `updateItem.test.ts`.

Still open: other fields such as `lastRelistResult` and `relistAttemptCount` are client-settable through the metadata payload, because the actions accept any schema field.
