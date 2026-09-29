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

	let dataItems = $state(data.post.GetMyeBaySellingResponse.UnsoldList?.ItemArray);
	// let editableItems = $state(dataItems); // Local writable copy for editing

	// $effect(() => {
  	// 	editableItems = dataItems; // keep in sync when derived changes
	// });

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(data.post.GetMyeBaySellingResponse.UnsoldList?.PaginationResult?.TotalNumberOfEntries);
	let totalNumberOfPages = $derived(data.post.GetMyeBaySellingResponse.UnsoldList?.PaginationResult?.TotalNumberOfPages);

</script>

<!-- full-screen busy overlay shown during client-side navigation to active-items -->
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

{#if dataItems == null || dataItems.length === 0}
	<p class="text-center mt-5">No Unsold items found.</p>
{:else}
	<div class="items-container">
		<div class="items-header mb-3">
			<h2>Unsold Items ({totalItems})</h2>
			<div class="auth-muted">
				Showing {currentPage} of {totalNumberOfPages} pages
			</div>
		</div>
		<table class="auth-table mb-4">
			<tbody>
					<!-- <tr>
						<td>{JSON.stringify(dataItems)}</td>
					</tr> -->
				{#each dataItems.Item as item}
					<tr>
						<!-- <td>{JSON.stringify(item)}</td> -->
						<td>
							<div class="flex items-center justify-center p-3">
								<img
									src={item.PictureDetails.GalleryURL}
									class="border item-image"
									alt={item.Title}
								/>
							</div>
						</td>
						<td>
							<p class="item-title text-base m-0">{item.Title}</p>
							<p class="auth-muted text-sm m-0">Item ID: {item.ItemID}</p>
							<p class="auth-positive text-sm m-0">${formatCurrency(item.SellingStatus.CurrentPrice)}</p>
							<!-- <p>Sold price: ${formatCurrency(order.TransactionArray.Transaction.TransactionPrice)}</p> -->
							<!-- <p>Shipping: ${formatCurrency(order.TransactionArray.Transaction.ActualShippingCost)}</p> -->
							<!-- <p>Sold: {formatIsoToMonDDYYYY(order.TransactionArray.Transaction.CreatedDate)}</p> -->
						</td>
						<!-- <td>
							<p>Purchase Price: ${formatCurrency(order.Metadata.purchasePrice ? order.Metadata.purchasePrice : '0')}</p>
							<p>Fee: ${order.TransactionArray.Transaction.FinalValueFee}</p>
							<p>Profit: ${calculateProfit(order)}</p>
							<p>ROI: {calculateROI(order)}</p>
							<p>Time To Sell: {getDayDifference(order.StartTime, order.EndTime)}</p>
							<p>Location: {order.Metadata.storageLocation ? order.Metadata.storageLocation : 'N/A'}</p>
						</td> -->
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="my-3 flex justify-center">
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		</div>
	</div>
{/if}

<style>
	.item-image {
		width: 100px;
		height: 100px;
	}
</style>
