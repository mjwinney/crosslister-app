<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount, tick } from 'svelte';
    // import CurrencyInput from '@canutin/svelte-currency-input';
	// import type { MetaDataModel } from '$lib/server/DatabaseUtils.js';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	// import DatePicker from '$lib/components/DatePicker.svelte';
	// import { navigating } from '$app/state';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/');
		}
	});

	// async function postMetaData(itemID: string, metaData: MetaDataModel) {
	// 	console.log('postMetaData called:', itemID, metaData);

	// 	const session = await authClient.getSession();
	// 	const userId = session.data?.session.userId || '';

	// 	const formData = new FormData();
	// 	formData.append('itemId', itemID);
	// 	formData.append('metaData', JSON.stringify(metaData));
	// 	formData.append('userId', userId);

	// 	const response = await fetch('/auth/active-items?/updateItem', {
	// 		method: 'POST',
	// 		body: formData
	// 	});
	// }

	/**
	 * Format an ISO date (or Date) as "Mon DD YYYY", e.g. "Nov 13 2025".
	 * Returns empty string for falsy/invalid input.
	 *
	 * @param {string|Date|null|undefined} iso
	 * @returns {string}
	 */
	export function formatIsoToMonDDYYYY(iso: string | Date | null | undefined): string {
	  if (!iso) return '';
	  const date = iso instanceof Date ? iso : new Date(String(iso));
	  if (isNaN(date.getTime())) return '';
	  const month = date.toLocaleString('en-US', { month: 'short' }); // "Nov"
	  const day = date.getDate(); // 1..31 (no leading zero)
	  const year = date.getFullYear();
	  return `${month} ${day} ${year}`;
	}

	function formatCurrency(amountStr: string): string {
		const amount = parseFloat(amountStr);
		if (isNaN(amount)) {
			throw new Error("Invalid number input");
		}
		return amount.toFixed(2);
	}

	function calculateProfit(order: any): string {
		const sold = parseFloat(order.TransactionArray.Transaction.TransactionPrice);
		const fee = parseFloat(order.TransactionArray.Transaction.FinalValueFee);
		const purchaseRaw = order.Metadata?.purchasePrice;

		if (purchaseRaw === undefined || isNaN(parseFloat(purchaseRaw))) {
			const profit = sold - fee;
			return `${formatCurrency(profit.toString())}`;
		}

		const purchase = parseFloat(purchaseRaw);
		const profit = sold - purchase - fee;
		return `${formatCurrency(profit.toString())}`;
	}


	function calculateROI(order: any): string {
		const profit = calculateProfit(order);
		const purchase = parseFloat(order.Metadata.purchasePrice ? order.Metadata.purchasePrice : '0');
		const fee = parseFloat(order.TransactionArray.Transaction.FinalValueFee);
		const totalCost = purchase + fee;

		const roi = (Number(profit) / totalCost) * 100;
		return roi.toFixed(2) + '%';
	}

	function parseISODate(isoString: string): Date {
		if (typeof isoString !== 'string') {
			throw new Error('Input must be a string in ISO format');
		}

		const date = new Date(isoString);

		if (isNaN(date.getTime())) {
			throw new Error('Invalid ISO date format');
		}

		return date;
	}

	function getDayDifference(startTime: string, endTime: string): string {

		// Calculate the difference in milliseconds
		const diffMs = parseISODate(endTime).getTime() - parseISODate(startTime).getTime();

		// Convert milliseconds to days
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		return diffDays === 1 ? `${diffDays} day` : `${diffDays} days`;
	}

    // Example: navigate to the same route with ?page=N
    async function handlePageChange(newPage: number) {

		isLoading = true;  // Loading spinner shown

		currentPage = newPage;
		const path = location.pathname;
        await goto(`?page=${newPage}`, { replaceState: true });
		await invalidateAll(); // Force re-execution of load functions
        await tick(); // wait for DOM to update with new data
		const container = document.querySelector('.items-container') as HTMLElement | null;

		if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

		isLoading = false;  // Loading spinner removed
    }

	let { data } = $props();

	const unsoldList = $derived(data.post?.GetMyeBaySellingResponse?.UnsoldList);

	// The XML parser returns a single object (not an array) when there is only one item
	const dataItems = $derived.by(() => {
		const raw = unsoldList?.ItemArray?.Item;
		if (!raw) return [];
		return Array.isArray(raw) ? raw : [raw];
	});

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(unsoldList?.PaginationResult?.TotalNumberOfEntries ?? 0);
	let totalNumberOfPages = $derived(unsoldList?.PaginationResult?.TotalNumberOfPages ?? 1);

</script>

<!-- full-screen busy overlay shown during client-side navigation -->
{#if isLoading}
	<div class="busy-overlay" aria-hidden={!isLoading}>
		<div class="text-center">
			<div class="auth-spinner" role="status">
				<span class="sr-only">Loading...</span>
			</div>
			<div class="mt-2 overlay-label">Loading…</div>
		</div>
	</div>
{/if}

<div class="items-container">
	<div class="items-header mb-3 gap-3">
		<h2 class="mb-0">Unsold Items ({totalItems})</h2>
		{#if dataItems.length > 0}
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
			<div class="auth-muted">
				Showing {currentPage} of {totalNumberOfPages} pages
			</div>
		{/if}
	</div>

	{#if dataItems.length === 0}
		<div class="empty-state">
			<p class="auth-muted">No items found</p>
		</div>
	{:else}
		<div class="items-list">
			{#each dataItems as item (item.ItemID)}
				<div class="item-row flex items-start border-b p-2">
					<div class="col-image mr-3 flex items-center justify-center p-3">
						<img src={item.PictureDetails?.GalleryURL} class="border item-image" alt={item.Title} />
					</div>

					<div class="col-info mr-3">
						<p class="item-title text-base m-0">{item.Title}</p>
						<p class="auth-muted text-sm m-0">Item ID: {item.ItemID}</p>
						<p class="auth-positive text-sm m-0">${formatCurrency(item.SellingStatus?.CurrentPrice)}</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="my-3 flex justify-center">
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		</div>
	{/if}
</div>

<style>
	.items-container {
		position: relative;
		max-height: calc(100vh - 74px);
		overflow: auto;
		padding: clamp(1rem, 2vw, 2rem);
		scrollbar-width: thin;
	}
	.items-container > * { position: relative; z-index: 1; }
	.items-container > .items-header { flex-wrap: wrap; padding: 0.25rem 0 1rem; }
	.items-container h2 { font-size: clamp(1.35rem, 2vw, 1.8rem); letter-spacing: 0; }

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		font-size: 1.25rem;
	}

	.item-row {
		gap: 0.75rem;
		flex-wrap: nowrap;
		align-items: center;
		border-radius: 10px;
		transition: background-color 180ms ease, box-shadow 180ms ease;
	}
	.item-image { width: 80px; height: 80px; border-radius: 8px; }

	.items-list { display: flex; flex-direction: column; gap: 0.75rem; }
	.col-image { flex: 0 0 80px; }
	.col-info { flex: 1 1 auto; min-width: 150px; }
	.col-info p { font-size: 1rem; margin: 0; }
	.col-info .item-title { font-weight: 700; }
	.col-info .auth-muted { font-size: 0.85rem; }
	.col-info .auth-positive { font-weight: 700; }

	@media (max-width: 900px) {
		.items-container { max-height: none; }
		.items-container > .items-header { align-items: flex-start; }
	}
	@media (max-width: 576px) {
		.items-container { padding: 1rem 0.75rem; }
		.items-container > .items-header { gap: 0.75rem; }
		.items-container h2 { width: 100%; }
	}
</style>