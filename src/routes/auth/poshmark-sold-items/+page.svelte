<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onDestroy, onMount, tick } from 'svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	import CurrencyInput from '@canutin/svelte-currency-input';
	import { fly } from 'svelte/transition';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		if (initialized) return;
			initialized = true;

		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/homepage	');
		}
		// console.log(currencyInputEl); // now defined

        clearInterval(interval);

        // Run immediately
        checkPoshmarkTabStatus();
        // checkPoshmarkTabLoginStatus();

        // Then every 5 seconds
        interval = setInterval(checkPoshmarkTabStatus, 5000);

        // Register message listeners (handlers are declared at module scope)
        window.addEventListener("message", handlePoshmarkTabResponse);
        window.addEventListener("message", handlePoshmarkLoggedInResponse);
        window.addEventListener("message", handlePoshmarkSoldItemsResponse);
	});

	function sendPoshmarkSoldItemsRequest() {
        // Send to server or extension to fetch sold items
        // console.log("sendPoshmarkSoldItemsRequest called");

		isLoading = true; // Show loading spinner while fetching data

		// This is going to go to the chrome extension content script,
		// which will then forward to the background script,
		// which will call our server API route.
		// We have to do it this way because the content script is the only 
		// part of our code that can access the cookies/local storage of the 
		// Poshmark web app to get the auth token needed to call Poshmark's API.

		// We need to get see how many days to go back in the poshmark sold items request.
		// To do this we can call database method getPoshmarkDaysInPastToScrape which will
		// check our database for the most recent sold item and calculate how many days back we need to go to get new items.
        window.postMessage({ type: "IMPORT_POSHMARK_SOLD_ITEMS", daysBack: daysToGoBack }, "*");
    }

	async function handlePoshmarkSoldItemsResponse(event: MessageEvent) {
		// console.log("handlePoshmarkSoldItemsResponse() called:" + JSON.stringify(event));

        if (event.data?.type === "POSHMARK_SOLD_DATA") {
            // console.log("Received POSHMARK_SOLD_DATA from Poshmark data:", event.data);
            // Handle response as needed
            // let poshMarkSoldItemsData = JSON.stringify(event.data.data);

			// Send the data to the page.server.ts so it can be saved to the database.
			const formData = new FormData();
			formData.append('data', JSON.stringify(event.data.data));

			const res = await fetch('/auth/poshmark-sold-items/save-poshmark-sold-items', {
				method: 'POST',
				body: formData
			});

			const data = await res.json();

			if (!res.ok) {
				console.error('Failed to send sold items to server', JSON.stringify(event.data.data));
				return {
					status: 'error',
					message: data
				};
			}

			// Action returns the data to be displayed in the UI
			// so save it to a variable that the UI can access.
			// const json = await res.json();
			// console.log('Imported sold items, server response:', json);

			// Save the data so it can be displayed in the UI. 
			// We have to do it this way because the load function only runs on page load,
			// and we want to update the UI immediately after importing without requiring a page refresh.
			// dataItems = json;
            // console.log("POSHMARK_SOLD_DATA EXIT");

			// Force the page to reload so it will re-run the load function and get the new data 
			// from the database, which was just updated with the imported sold items.
			await handlePageChange(1);
		}
    }

	async function updatePurchasePrice(order: any, newValue: number) {
		console.log(`updatePurchasePrice called with:${JSON.stringify(order)}, newValue=${newValue}`);
		const session = await authClient.getSession();
		const userId = session.data?.session.userId || '';

		const formData = new FormData();
		formData.append('itemId', order.itemId);
		formData.append('metaData', JSON.stringify({ purchasePrice: newValue }));
		formData.append('userId', userId);

		console.log(`updatePurchasePrice formData:itemId=${formData.get('itemId')}, metaData=${formData.get('metaData')}, userId=${formData.get('userId')}`);

		await fetch('/auth/poshmark-sold-items?/updateItem', {
			method: 'POST',
			body: formData
		});

		// Update local data so UI reflects immediately
		editableItems = editableItems.map((it: any) =>
			String(it.itemId) === String(order.itemId) ? { ...it, purchasePrice: newValue } : it
		);
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

	function calculateProfit(order: any): string {
		const sold = parseFloat(order.soldPrice || '0');
		const fee = parseFloat(order.feePrice || '0');
		const purchase = parseFloat(order.purchasePrice || '0');
		const profit = sold - purchase - fee;
		return `${formatCurrency(profit.toString())}`;
	}

	function calculateROI(order: any): string {
		const profit = calculateProfit(order);
		const purchase = parseFloat(order.purchasePrice ? order.purchasePrice : '0');
		if (purchase === 0) {
			return 'N/A';
		}
		const roi = (Number(profit) / purchase) * 100;
		return roi.toFixed(2) + '%';
	}

    // Example: navigate to the same route with ?page=N
    async function handlePageChange(newPage: number) {

		isLoading = true;  // Loading spinner shown

		currentPage = newPage;
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
		console.log(`startEditing called for order ${JSON.stringify(order)}, index ${index}`);

		const el = itemsElements[index];
		if (el) {
			const rect = el.getBoundingClientRect();
			dialogPos = { top: rect.top + window.scrollY, left: rect.left };
		}

		tempPurchasePrice = order.purchasePrice || 0;
		editingIndex = index;
	}

	async function stopEditing() {
		const idx = editingIndex;
		if (idx < 0) return;
		const order = editableItems[idx];
		// Coerce tempPurchasePrice to number before saving
		const newVal = Number(tempPurchasePrice);
		// Update local copy so UI updates immediately
		editableItems = editableItems.map((it: any, i: number) =>
			i === idx ? { ...it, purchasePrice: newVal } : it
		);
		editingIndex = -1;
		await updatePurchasePrice(order, newVal);
	}

	function cancelEditing() {
		editingIndex = -1;
	}

    function checkPoshmarkTabStatus() {
        // console.log("Checking Poshmark tab");

        // Tell extension to check if it's open. When a response arrives
        // we will request the logged-in status once from the response handler.
        window.postMessage({ type: "CHECK_POSHMARK_TAB" }, "*");
    }

    function checkPoshmarkTabLoginStatus() {
        console.log("Checking Poshmark login tab status");

        // Tell extension to check logged-in user
        window.postMessage({ type: "CHECK_POSHMARK_TAB_USER_LOGGED_IN" }, "*");
    }

	function openPoshmarkTab() {
		// Semd message to extension to open Poshmark tab
		window.postMessage({ type: "OPEN_POSHMARK_TAB" }, "*");
	}

    // Named handlers so we can remove them on destroy and avoid duplicates
    function handlePoshmarkTabResponse(event: MessageEvent) {
        if (event.data?.type === "CHECK_POSHMARK_TAB_RESPONSE") {
            console.log("Received CHECK_POSHMARK_TAB_RESPONSE from Poshmark data:", event.data.data);
            poshMarkTabExists = event.data.data;

			console.log(`Poshmark tab exists: ${poshMarkTabExists}`);
            // If the tab exists, request the logged-in UID once
            if (poshMarkTabExists)
                checkPoshmarkTabLoginStatus();
            else
                poshMarkTabLoggedInUid = "";
        }
    }

    function handlePoshmarkLoggedInResponse(event: MessageEvent) {
		console.log("handlePoshmarkLoggedInResponse() called:" + JSON.stringify(event));
        if (event.data?.type === "CHECK_POSHMARK_TAB_USER_LOGGED_IN_RESPONSE") {
            console.log("Received CHECK_POSHMARK_TAB_USER_LOGGED_IN_RESPONSE from Poshmark data:", event.data);
            poshMarkTabLoggedInUid = event.data.uid;
        }
    }

	// Stop timed callbacks when navigating away
    beforeNavigate(() => {
        clearInterval(interval);
    });

	// Clean up listeners and intervals when this component is destroyed
    onDestroy(() => {
        clearInterval(interval);
        if (typeof window !== 'undefined') {
            window.removeEventListener("message", handlePoshmarkTabResponse);
            window.removeEventListener("message", handlePoshmarkLoggedInResponse);
			window.removeEventListener("message", handlePoshmarkSoldItemsResponse);
        }
        initialized = false;
    });

	let { data } = $props();
	const daysToGoBack = data.post.daysToGoBack;

	let dataItems = $derived(data.post.data);

	// Local writable copy of items so we can update UI reactively
	let editableItems = $state(dataItems?.items ?? []);
	$effect(() => {
		editableItems = dataItems?.items ?? [];
	});

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(data.post.data.totalItemCount);
	let totalNumberOfPages = $derived(data.post.data.totalItemCount > 0 ? Math.ceil(data.post.data.totalItemCount / 20) : 0);
	
	// Track which item is being edited
	let tempPurchasePrice = $state(0);
	let editingIndex = $state(-1);

	// Reactive debug logging to verify state updates (use $effect in runes mode)
	// $effect(() => {
	// 	console.log('editingItemId,temp,type', editingItemId, tempPurchasePrice, typeof tempPurchasePrice);
	// });
	// let currencyInputEl: InstanceType<typeof CurrencyInput> | null = null;
	let itemsElements: HTMLElement[] = [];
	let dialogPos = { top: 0, left: 0 };

	let poshMarkTabExists = $state(false);
    let poshMarkTabLoggedInUid = $state("");
    let poshMarkTabLoggedIn = $derived(poshMarkTabExists && poshMarkTabLoggedInUid !== "");
    let interval: NodeJS.Timeout;
	let initialized = false;


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
	<p class="text-center mt-5">No sold items found.</p>
{:else}
	<div class="items-container">
		<div class="d-flex justify-content-left">
			<!-- <button type="button" class="btn btn-primary" onclick={sendPoshmarkSoldItemsRequest}> -->
			{#if poshMarkTabExists && poshMarkTabLoggedIn}
				<button type="button" class="btn btn-primary" onclick={sendPoshmarkSoldItemsRequest}>
					Import
				</button>
			{:else if poshMarkTabExists && !poshMarkTabLoggedIn}
				<button type="button" class="btn btn-primary" onclick={sendPoshmarkSoldItemsRequest}>
					User not logged in
				</button>
			{:else}
				<button type="button" class="btn btn-primary" onclick={openPoshmarkTab}>
					Open POSHMARK tab
				</button>
			{/if}
		</div>
		<div class="d-flex justify-content-between align-items-center mb-3">
			<h2>Sold Items ({totalItems})</h2>
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
			<div class="text-muted">
				Showing {currentPage} of {totalNumberOfPages} pages
			</div>
		</div>
		<table class="table table-light table-striped mb-4">
			<tbody>
				{#each editableItems as order, index}
					<tr>
						<td>
							<div class="col-md-auto d-flex align-items-center justify-content-center p-3">
								<img
									src={order.pictureURL || '/placeholder-image.png'}
									class="border item-image"
									alt={order.title}
								/>
							</div>
						</td>
						<td>
							<p class="card-title fs-6 mb-0">{order.title}</p>
							<p class="card-text text-muted fs-6 mb-0">Item ID: {order.itemId}</p>
							<p class="mb-0 fs-5 text-success">${formatCurrency(order.soldPrice)}</p>
							<!-- {#if order.TransactionArray.Transaction.ActualShippingCost > 0}
								<p class="text-muted fs-6 mb-0">Shipping: ${formatCurrencyFromNumber(getShippingCost(order))}</p>
							{:else} -->
								<p class="text-muted fs-6 mb-0">Shipping: Paid by seller</p>
							<!-- {/if} -->
							<p class="text-muted fs-6 mb-0">Sold: {formatIsoToMonDDYYYY(order.soldTime)}</p>
						</td>
						<td>
							<table class="table-sm">
								<tbody>
									<tr>
										<td class="fs-6 mb-0 py-0">Purchase Price:</td>
										<td class="fs-6 mb-0 py-0">${formatCurrency(editingIndex === index ? tempPurchasePrice : (order.purchasePrice || 0))}
																	<button class="btn p-0 ms-2" onclick={() => startEditing(order, index)} title="Edit purchase price">✏️</button>
										</td>
									</tr>
									<tr>
										<td class="fs-6 mb-0 py-0">Fee:</td>
										<td class="text-danger fs-6 mb-0 py-0">${formatCurrency(order.feePrice)}</td>
									</tr>
									<!-- <tr>
										{#if calculateShipping(order) >= 0}
											<td class="fs-6 mb-0 py-0">Shipping:</td>
											<td class="text-success fs-6 mb-0 py-0">${formatCurrencyFromNumber(calculateShipping(order))}  <span class="text-muted fs-6 mb-0"> {formatShippingCalc(order)}</span></td>
										{:else}
											<td class="fs-6 mb-0 py-0">Shipping:</td>
											<td class="text-danger fs-6 mb-0 py-0">${formatCurrencyFromNumber(calculateShipping(order))}  <span class="text-muted fs-6 mb-0"> {formatShippingCalc(order)}</span></td>
										{/if}
									</tr> -->
									<!-- <tr>
										<td class="fs-6 mb-0 py-0">Promo Fee:</td>
										{#if order.addFeeGeneral > 0}
											<td class="text-danger fs-6 mb-0 py-0">${formatCurrency(order.addFeeGeneral)}</td>
										{:else}
											<td class="text-muted fs-6 mb-0 py-0">---</td>
										{/if}
									</tr> -->
									<tr>
										<td class="fs-6 mb-0 py-0">Profit:</td>
										<td class="text-success fs-6 mb-0 py-0">${calculateProfit(order)}</td>
									</tr>
									<tr>
										<td class="fs-6 mb-0 py-0">ROI:</td>
										<td class="text-success fs-6 mb-0 py-0">{calculateROI(order)}</td>	
									</tr>
									<!-- <tr>
										<td class="fs-6 mb-0 py-0">Time To Sell:</td>
										<td class="fs-6 mb-0 py-0">{getDayDifference(order.StartTime, order.EndTime)}</td>
									</tr> -->
									<tr>
										<td class="fs-6 mb-0 py-0">Location:</td>
										<!-- <td class="fs-6 mb-0 py-0">{order.Metadata.storageLocation ? order.Metadata.storageLocation : 'N/A'}</td> -->
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<!-- Slide-in dialog -->
		{#if editingIndex !== -1}
			<div class="side-dialog bg-light shadow p-3"
				style="position:absolute; top:{dialogPos.top}px; left:{dialogPos.left}px; z-index:1000;"
				transition:fly={{ x: 200, duration: 300 }}>
				<h6>Edit Purchase Price</h6>
				<!-- Temporary plain input to isolate reactivity of the CurrencyInput component -->
				<input
					type="text"
					class="form-control"
					bind:value={tempPurchasePrice}
				/>
				<div class="mt-3 d-flex justify-content-end gap-2">
				<button class="btn btn-secondary btn-sm" onclick={() => cancelEditing()}>
					Cancel
				</button>
				<button class="btn btn-primary btn-sm" onclick={() => stopEditing()}>
					Save
				</button>
				</div>
			</div>
		{/if}

		<!-- Debug panel (temporary) -->
		{#if editingIndex !== -1}
			<div class="alert alert-secondary mt-2">editingIndex: {editingIndex} — temp: {tempPurchasePrice} — type: {typeof tempPurchasePrice}</div>
		{/if}

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
