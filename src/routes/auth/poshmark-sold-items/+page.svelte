<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount, tick } from 'svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	import CurrencyInput from '@canutin/svelte-currency-input';
	import { fly } from 'svelte/transition';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/homepage	');
		}
		console.log(currencyInputEl); // now defined

		// Register message listeners (handlers are declared at module scope)
        window.addEventListener("message", handlePoshmarkSoldItemsResponse);

		// Go get poshmark sold items when page loads
		sendPoshmarkSoldItemsRequest();
	});

	function sendPoshmarkSoldItemsRequest() {
        // Send to server or extension to fetch sold items
        console.log("sendPoshmarkSoldItemsRequest called");

		// This is going to go to the chrome extension content script,
		// which will then forward to the background script,
		// which will call our server API route.
		// We have to do it this way because the content script is the only 
		// part of our code that can access the cookies/local storage of the 
		// Poshmark web app to get the auth token needed to call Poshmark's API.
        window.postMessage({ type: "IMPORT_POSHMARK_SOLD_ITEMS" }, "*");
    }

	async function handlePoshmarkSoldItemsResponse(event: MessageEvent) {
		console.log("handlePoshmarkSoldItemsResponse() called:");

        if (event.data?.type === "POSHMARK_SOLD_DATA") {
            console.log("Received POSHMARK_SOLD_DATA from Poshmark data:", event.data);
            // Handle response as needed
            // let poshMarkSoldItemsData = JSON.stringify(event.data.data);

			// Send the data to the page.server.ts so it can be saved to the database.
			const formData = new FormData();
			formData.append('data', JSON.stringify(event.data.data));

			const res = await fetch('/auth/poshmark-sold-items/savePoshmarkSoldItems', {
				method: 'POST',
				body: formData
			});

			// Action returns the data to be displayed in the UI
			// so save it to a variable that the UI can access.
			const json = await res.json();
			console.log('Imported sold items, server response:', json);

			// Save the data so it can be displayed in the UI. 
			// We have to do it this way because the load function only runs on page load,
			// and we want to update the UI immediately after importing without requiring a page refresh.
			dataItems = json;
		}
    }

	async function updatePurchasePrice(order: any, newValue: number) {
		const session = await authClient.getSession();
		const userId = session.data?.session.userId || '';

		const formData = new FormData();
		formData.append('itemId', order.TransactionArray.Transaction.Item.ItemID);
		formData.append('metaData', JSON.stringify({ purchasePrice: newValue }));
		formData.append('userId', userId);

		await fetch('/auth/active-items?/updateItem', {
			method: 'POST',
			body: formData
		});

		// Update local data so UI reflects immediately
		order.Metadata.purchasePrice = newValue;
	}

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

	function formatCurrencyFromNumber(amount: number): string {
		return amount.toFixed(2);
	}

	function getShippingCost(order: any): number {
		if (order.IsMultiLegShipping) {
			return parseFloat(order.MultiLegShippingDetails.SellerShipmentToLogisticsProvider.ShippingServiceDetails.TotalShippingCost || '0');
		}
		const shippingCost = parseFloat(order.TransactionArray.Transaction.ActualShippingCost || '0');
		return shippingCost;
	}

	function calculateProfit(order: any): string {
		const sold = parseFloat(order.TransactionArray.Transaction.TransactionPrice || '0');
		const fee = parseFloat(order.finalValueFee || '0');
		const shippingCost = calculateShipping(order);
		const addFeeGeneral = parseFloat(order.addFeeGeneral || '0');
		const purchaseRaw = order.Metadata?.purchasePrice;

		if (purchaseRaw === undefined || isNaN(parseFloat(purchaseRaw))) {
			const profit = sold - fee + shippingCost - addFeeGeneral;
			return `${formatCurrency(profit.toString())}`;
		}

		const purchase = parseFloat(purchaseRaw);
		const profit = sold - purchase - fee + shippingCost - addFeeGeneral;
		return `${formatCurrency(profit.toString())}`;
	}

	function calculateShipping(order: any): number {
		const sellerShippingLabelCost = parseFloat(order.shippingLabelCost || '0');
		const buyerShippingCost = getShippingCost(order);
		const profitShipping = buyerShippingCost - sellerShippingLabelCost;

		return profitShipping;
	}

	function formatShippingCalc(order: any): string {
		const sellerShippingLabelCost = parseFloat(order.shippingLabelCost || '0');
		const buyerShippingCost = getShippingCost(order);

		if (buyerShippingCost === 0) {
			return `(Paid by seller)`;
		}

		return `($${formatCurrency(buyerShippingCost.toString())} - $${formatCurrency(sellerShippingLabelCost.toString())})`;
	}

	function calculateROI(order: any): string {
		const profit = calculateProfit(order);
		const purchase = parseFloat(order.Metadata.purchasePrice ? order.Metadata.purchasePrice : '0');
		const roi = (Number(profit) / purchase) * 100;
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

	function startEditing(order: any, index: number) {
		editingItem = order;

		const rect = itemsElements[index].getBoundingClientRect();
	    dialogPos = { top: rect.top + window.scrollY, left: rect.left };

		tempPurchasePrice = order.Metadata.purchasePrice || '0';
	}

	async function stopEditing(order: any) {
		editingItem = null;
		// editingItemId = "";
		order.Metadata.purchasePrice = tempPurchasePrice;
		await updatePurchasePrice(order, tempPurchasePrice);
	}

	function cancelEditing() {
    	editingItem = null;
	}

	let dataItems = $state([]);

	// let { data } = $props();

	// let dataItems = $derived(data.post.GetOrdersResponse?.OrderArray);

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	// let totalItems = $derived(data.post.GetOrdersResponse?.PaginationResult.TotalNumberOfEntries);
	// let totalNumberOfPages = $derived(data.post.GetOrdersResponse?.PaginationResult.TotalNumberOfPages);
	
	// Track which item is being edited
	let tempPurchasePrice = $state(0);
	let currencyInputEl: InstanceType<typeof CurrencyInput> | null = null;

	let editingItem = $state(null);
	let itemsElements: HTMLElement[] = [];
	let dialogPos = { top: 0, left: 0 };
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

<!-- {#if dataItems == null || dataItems.length === 0}
	<p class="text-center mt-5">No sold items found.</p>
{:else} -->
	<div class="items-container">
		<div class="d-flex justify-content-between align-items-center mb-3">
			<!-- <h2>Sold Items ({totalItems})</h2> -->
			<!-- <div class="text-muted">
				Showing {currentPage} of {totalNumberOfPages} pages
			</div> -->
		</div>
		<table class="table table-light table-striped mb-4">
			<tbody>
				<!-- {#each dataItems?.Order as order, index}
					<tr>
						<td>
							<div class="col-md-auto d-flex align-items-center justify-content-center p-3">
								<img
									src={order.PictureURL}
									class="border item-image"
									alt={order.TransactionArray.Transaction.Item.Title}
								/>
							</div>
						</td>
						<td>
							<p class="card-title fs-6 mb-0">{order.TransactionArray.Transaction.Item.Title}</p>
							<p class="card-text text-muted fs-6 mb-0">Item ID: {order.TransactionArray.Transaction.Item.ItemID}</p>
							<p class="mb-0 fs-5 text-success">${formatCurrency(order.TransactionArray.Transaction.TransactionPrice)}</p>
							{#if order.TransactionArray.Transaction.ActualShippingCost > 0}
								<p class="text-muted fs-6 mb-0">Shipping: ${formatCurrencyFromNumber(getShippingCost(order))}</p>
							{:else}
								<p class="text-muted fs-6 mb-0">Shipping: Paid by seller</p>
							{/if}
							<p class="text-muted fs-6 mb-0">Sold: {formatIsoToMonDDYYYY(order.TransactionArray.Transaction.CreatedDate)}</p>
						</td>
						<td bind:this={itemsElements[index]}>
							<table class="table-sm">
								<tbody>
									<tr>
										<td class="fs-6 mb-0 py-0">Purchase Price:</td>
										<td class="fs-6 mb-0 py-0">${formatCurrency(order.Metadata.purchasePrice ? order.Metadata.purchasePrice : '0')}
											<button class="btn p-0 ms-2" onclick={() => startEditing(order, index)} title="Edit purchase price">✏️</button>
										</td>
									</tr>
									<tr>
										<td class="fs-6 mb-0 py-0">Fee:</td>
										<td class="text-danger fs-6 mb-0 py-0">${formatCurrency(order.finalValueFee)}</td>
									</tr>
									<tr>
										{#if calculateShipping(order) >= 0}
											<td class="fs-6 mb-0 py-0">Shipping:</td>
											<td class="text-success fs-6 mb-0 py-0">${formatCurrencyFromNumber(calculateShipping(order))}  <span class="text-muted fs-6 mb-0"> {formatShippingCalc(order)}</span></td>
										{:else}
											<td class="fs-6 mb-0 py-0">Shipping:</td>
											<td class="text-danger fs-6 mb-0 py-0">${formatCurrencyFromNumber(calculateShipping(order))}  <span class="text-muted fs-6 mb-0"> {formatShippingCalc(order)}</span></td>
										{/if}
									</tr>
									<tr>
										<td class="fs-6 mb-0 py-0">Promo Fee:</td>
										{#if order.addFeeGeneral > 0}
											<td class="text-danger fs-6 mb-0 py-0">${formatCurrency(order.addFeeGeneral)}</td>
										{:else}
											<td class="text-muted fs-6 mb-0 py-0">---</td>
										{/if}
									</tr>
									<tr>
										<td class="fs-6 mb-0 py-0">Profit:</td>
										<td class="text-success fs-6 mb-0 py-0">${calculateProfit(order)}</td>
									</tr>
									<tr>
										<td class="fs-6 mb-0 py-0">ROI:</td>
										<td class="text-success fs-6 mb-0 py-0">{calculateROI(order)}</td>	
									</tr>
									<tr>
										<td class="fs-6 mb-0 py-0">Time To Sell:</td>
										<td class="fs-6 mb-0 py-0">{getDayDifference(order.StartTime, order.EndTime)}</td>
									</tr>
									<tr>
										<td class="fs-6 mb-0 py-0">Location:</td>
										<td class="fs-6 mb-0 py-0">{order.Metadata.storageLocation ? order.Metadata.storageLocation : 'N/A'}</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				{/each} -->
			</tbody>
		</table>

		<!-- Slide-in dialog -->
		{#if editingItem}
			<div class="side-dialog bg-light shadow p-3"
				style="position:absolute; top:{dialogPos.top}px; left:{dialogPos.left}px; z-index:1000;"
				transition:fly={{ x: 200, duration: 300 }}>
				<h6>Edit Purchase Price</h6>
				<CurrencyInput
				bind:value={tempPurchasePrice}
				currency="USD"
				locale="en-US"
				inputClasses={{
					unformatted: "form-control",
					formatted: "form-control",
					formattedPositive: "form-control",
					formattedNegative: "form-control",
				}}
				/>
				<div class="mt-3 d-flex justify-content-end gap-2">
				<button class="btn btn-secondary btn-sm" onclick={() => cancelEditing()}>
					Cancel
				</button>
				<button class="btn btn-primary btn-sm" onclick={() => stopEditing(editingItem)}>
					Save
				</button>
				</div>
			</div>
		{/if}

		<div class="my-3 d-flex justify-content-center">
			<!-- <Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} /> -->
		</div>
	</div>
<!-- {/if} -->

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
