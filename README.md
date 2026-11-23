# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Migrate eBay items

eBay items remain in `ebayitemmetadatas`, keyed by `userId` and `itemId`. Listing details are embedded in `listing`, sale details in `sold`, and purchase and relist fields remain at the top level. The app can read both the old and new layouts while users are migrated. `ebaysolds` is a separate per-user sync checkpoint and is not changed.

Before migrating, back up the database, deploy this version, stop all older app versions, and stop writes for the user being migrated (including scheduled relists and sync jobs). Verify that `MONGODB_URI` in the environment or `.env` points to the intended database. From the project root, run:

```powershell
node scripts\migrate-ebay-items.mjs "USER_ID"
```

The script moves that user's legacy listing and sale fields into the embedded objects, merges the old active and sold records, and deletes those old records only after copying them. For older metadata with no `itemId`, it restores `itemId` from a string `_id` (the original eBay item ID). Existing embedded values win over conflicting legacy values; otherwise, the active record's start time takes precedence over the old metadata listing time. Inspect the backup if a conflict needs review. Other users are untouched.

The script skips records it cannot safely migrate, including duplicate item records, missing or invalid item IDs, unexpected legacy fields, and individual write failures. It continues with other items and reports each skipped record by collection and `_id`. Related records for a conflicting or failed item are also skipped to avoid combining the wrong data. A run with skipped records exits with an error; review and resolve those records before rerunning. A database connection or cursor failure may still stop the entire run.

The migration is not transactional: if it fails partway through, keep writes stopped, inspect the error, and rerun it after correcting the problem. It is safe to rerun for the same user. Test the migrated user's item pages, relisting, dashboard, and reports before resuming writes.
