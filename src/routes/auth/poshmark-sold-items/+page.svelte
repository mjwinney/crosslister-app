<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onDestroy, onMount, tick } from 'svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { poshmarkTabOpen, poshmarkTabLoggedInUid } from '$lib/stores/poshmark';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		if (initialized) return;
			initialized = true;

		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/');
		}

        // Register message listeners (handlers are declared at module scope)
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
            console.log("Received POSHMARK_SOLD_DATA from Poshmark data:", event.data);
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

	function formatCurrency(amount: number | string | null | undefined): string {
		const parsed = Number(amount ?? 0);
		if (!Number.isFinite(parsed)) {
			return '0.00';
		}
		return parsed.toFixed(2);
	}

	function calculateProfit(order: any): string {
		const sold = Number(order?.soldPrice ?? 0);
		const fee = Number(order?.feePrice ?? 0);
		const purchase = Number(order?.purchasePrice ?? 0);
		const profit = sold - purchase - fee;
		return formatCurrency(profit);
	}

	function calculateROI(order: any): string {
		const profit = Number(calculateProfit(order));
		const purchase = Number(order?.purchasePrice ?? 0);
		if (purchase === 0) {
			return 'N/A';
		}
		const roi = (profit / purchase) * 100;
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

	function openPoshmarkTab() {
		// Semd message to extension to open Poshmark tab
		window.postMessage({ type: "OPEN_POSHMARK_TAB" }, "*");
	}

	// Stop timed callbacks when navigating away
    beforeNavigate(() => {
    });

	// Clean up listeners and intervals when this component is destroyed
    onDestroy(() => {
        if (typeof window !== 'undefined') {
			window.removeEventListener("message", handlePoshmarkSoldItemsResponse);
        }
        initialized = false;
    });

	let { data } = $props();
	const daysToGoBack = $derived(data?.post?.daysToGoBack ?? 90);

	let dataItems = $derived(data?.post?.data ?? { itemCount: 0, totalItemCount: 0, items: [] });

	// Local writable copy of items so we can update UI reactively
	let editableItems = $state(dataItems?.items ?? []);
	$effect(() => {
		editableItems = dataItems?.items ?? [];
	});

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(dataItems.totalItemCount ?? 0);
	let totalNumberOfPages = $derived((dataItems.totalItemCount ?? 0) > 0 ? Math.ceil((dataItems.totalItemCount ?? 0) / 20) : 0);
	
	// Track which item is being edited
	let tempPurchasePrice = $state(0);
	let editingIndex = $state(-1);

	// Reactive debug logging to verify state updates (use $effect in runes mode)
	// $effect(() => {
	// 	console.log('editingItemId,temp,type', editingItemId, tempPurchasePrice, typeof tempPurchasePrice);
	// });
	// let currencyInputEl: InstanceType<typeof CurrencyInput> | null = null;
	let itemsElements: HTMLElement[] = [];
	let dialogPos = $state({ top: 0, left: 0 });

    let poshMarkTabLoggedIn = $derived($poshmarkTabOpen && $poshmarkTabLoggedInUid !== "");
	let poshMarkTabOpenButNotLoggedIn = $derived($poshmarkTabOpen && ($poshmarkTabLoggedInUid === "" || $poshmarkTabLoggedInUid === null));
	let initialized = false;


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

{#if editableItems == null || editableItems.length === 0}
	<div class="text-center mt-5">No sold items found.
		{#if poshMarkTabLoggedIn}
			<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3 mt-2" onclick={sendPoshmarkSoldItemsRequest}>
				Refresh
			</button>
		{:else if poshMarkTabOpenButNotLoggedIn}
			<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3 mt-2" onclick={openPoshmarkTab}>
				User not logged in
			</button>
		{:else}
			<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3 mt-2" onclick={openPoshmarkTab}>
				Open POSHMARK tab
			</button>
		{/if}
	</div>
{:else}
	<div class="items-container">
		<div class="items-header mb-3">
			<div class="flex items-center">
				<h2 class="mb-0">Sold Items ({totalItems})</h2>
				{#if poshMarkTabLoggedIn}
					<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3 mt-2" onclick={sendPoshmarkSoldItemsRequest}>
						Refresh
					</button>
				{:else if poshMarkTabOpenButNotLoggedIn}
					<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3 mt-2" onclick={openPoshmarkTab}>
						User not logged in
					</button>
				{:else}
					<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3 mt-2" onclick={openPoshmarkTab}>
						Open POSHMARK tab
					</button>
				{/if}
			</div>
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
			<div class="auth-muted">
				Showing {currentPage} of {totalNumberOfPages} pages
			</div>
		</div>
		<table class="auth-table mb-4">
			<tbody>
				{#each editableItems as order, index}
					<tr>
						<td>
							<div class="flex items-center justify-center p-3">
								<img
									src={order.pictureURL || '/placeholder-image.png'}
									class="border item-image"
									alt={order.title}
								/>
							</div>
						</td>
						<td>
							<p class="item-title text-base m-0">{order.title}</p>
							<p class="auth-muted text-sm m-0">Item ID: {order.itemId}</p>
							<p class="auth-positive text-lg m-0">${formatCurrency(order.soldPrice)}</p>
									<p class="auth-muted text-sm m-0">Shipping: Paid by seller</p>
							<p class="auth-muted text-sm m-0">Sold: {formatIsoToMonDDYYYY(order.soldTime)}</p>
						</td>
						<td bind:this={itemsElements[index]}>
							<table class="auth-table auth-table-compact">
								<tbody>
									<tr>
										<td>Purchase Price:</td>
										<td>${formatCurrency(editingIndex === index ? tempPurchasePrice : (order.purchasePrice || 0))}
											<button class="icon-action ml-2" onclick={() => startEditing(order, index)} title="Edit purchase price">✏️</button>
										</td>
									</tr>
									<tr>
										<td>Fee:</td>
										<td class="auth-negative">${formatCurrency(order.feePrice)}</td>
									</tr>
									<tr>
										<td>Profit:</td>
										<td class="auth-positive">${calculateProfit(order)}</td>
									</tr>
									<tr>
										<td>ROI:</td>
										<td class="auth-positive">{calculateROI(order)}</td>	
									</tr>
									<tr>
										<td>Location:</td>
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
			<div class="side-dialog shadow p-3"
				style="position:absolute; top:{dialogPos.top}px; left:{dialogPos.left}px; z-index:1000;"
				transition:fly={{ x: 200, duration: 300 }}>
				<h6>Edit Purchase Price</h6>
				<!-- Temporary plain input to isolate reactivity of the CurrencyInput component -->
				<input
					type="text"
					class="auth-field"
					bind:value={tempPurchasePrice}
				/>
				<div class="mt-3 flex justify-end gap-2">
				<button class="auth-button auth-button-secondary" onclick={() => cancelEditing()}>
					Cancel
				</button>
				<button class="auth-button auth-button-primary" onclick={() => stopEditing()}>
					Save
				</button>
				</div>
			</div>
		{/if}

		<!-- Debug panel (temporary) -->
		{#if editingIndex !== -1}
			<div class="debug-panel mt-2">editingIndex: {editingIndex} — temp: {tempPurchasePrice} — type: {typeof tempPurchasePrice}</div>
		{/if}

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
