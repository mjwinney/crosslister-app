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
			goto('/homepage	');
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
            <div class="spinner-border text-light" role="status" style="width:3rem; height:3rem;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2 text-light">Loading…</div>
        </div>
    </div>
{/if}

{#if dataItems == null || dataItems.length === 0}
	<p class="text-center mt-5">No Unsold items found.</p>
{:else}
	<div class="items-container">
		<div class="d-flex justify-content-between align-items-center mb-3">
			<h2>Unsold Items ({totalItems})</h2>
			<div class="text-muted">
				Showing {currentPage} of {totalNumberOfPages} pages
			</div>
		</div>
		<table class="table table-light table-striped mb-4">
			<tbody>
					<!-- <tr>
						<td>{JSON.stringify(dataItems)}</td>
					</tr> -->
				{#each dataItems.Item as item}
					<tr>
						<!-- <td>{JSON.stringify(item)}</td> -->
						<td>
							<div class="col-md-auto d-flex align-items-center justify-content-center p-3">
								<img
									src={item.PictureDetails.GalleryURL}
									class="border item-image"
									alt={item.Title}
								/>
							</div>
						</td>
						<td>
							<p class="card-title fs-6 mb-0">{item.Title}</p>
							<p class="card-text text-muted fs-6 mb-0">Item ID: {item.ItemID}</p>
							<p class="mb-0 fs-6 text-success">${formatCurrency(item.SellingStatus.CurrentPrice)}</p>
							<!-- <p class="mb-0 fs-5 text-success">${formatCurrency(order.TransactionArray.Transaction.TransactionPrice)}</p> -->
							<!-- <p class="text-muted fs-6 mb-0">Shipping: ${formatCurrency(order.TransactionArray.Transaction.ActualShippingCost)}</p> -->
							<!-- <p class="text-muted fs-6 mb-0">Sold: {formatIsoToMonDDYYYY(order.TransactionArray.Transaction.CreatedDate)}</p> -->
						</td>
						<!-- <td>
							<p class="fs-6 mb-0">Purchase Price: ${formatCurrency(order.Metadata.purchasePrice ? order.Metadata.purchasePrice : '0')}</p>
							<p class="fs-6 mb-0">Fee: <span class="text-danger fs-6 mb-0">${order.TransactionArray.Transaction.FinalValueFee}</span></p>
							<p class="fs-6 mb-0">Profit: <span class="text-success fs-6 mb-0">${calculateProfit(order)}</span></p>
							<p class="fs-6 mb-0">ROI: <span class="text-success fs-6 mb-0">{calculateROI(order)}</span></p>
							<p class="fs-6 mb-0">Time To Sell: <span class="text fs-6 mb-0">{getDayDifference(order.StartTime, order.EndTime)}</span></p>
							<p class="fs-6 mb-0">Location: <span class="text fs-6 mb-0">{order.Metadata.storageLocation ? order.Metadata.storageLocation : 'N/A'}</span></p>
						</td> -->
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="my-3 d-flex justify-content-center">
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		</div>
	</div>
{/if}

<style>
    .busy-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999; /* ensure overlay is on top */
        pointer-events: all;
    }
    .busy-overlay .text-light { color: #fff !important; }

    .items-container {
        max-height: calc(100vh - 120px); /* Adjust 150px based on your header/footer size */
        overflow-y: auto;
        padding: 1rem;
        /* Optional: Add a subtle scrollbar style */
        scrollbar-width: thin;
        scrollbar-color: #888 #f1f1f1;
    }
	.item-image {
		width: 100px;
		height: 100px;
		object-fit: contain;	
		background-color: #f8f9fa;
	}
</style>
