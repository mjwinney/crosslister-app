<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onDestroy, onMount, tick } from 'svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	import { poshmarkTabOpen, poshmarkTabLoggedInUid } from '$lib/stores/poshmark';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);
	let isRefreshing = $state(false);
	let sessionReady = $state(false);
	let refreshError = $state('');
	let refreshRequested = false;
	let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
	let destroyed = false;

	onMount(async () => {
		if (initialized) return;
			initialized = true;

		const session = await authClient.getSession();
		if (destroyed) return;
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/');
			return;
		}

        // Register message listeners (handlers are declared at module scope)
        window.addEventListener("message", handlePoshmarkSoldItemsResponse);
		sessionReady = true;
	});

	$effect(() => {
		if (sessionReady && $poshmarkTabOpen && $poshmarkTabLoggedInUid && !refreshRequested) {
			refreshRequested = true;
			sendPoshmarkSoldItemsRequest();
		}
	});

	function sendPoshmarkSoldItemsRequest() {
        // Send to server or extension to fetch sold items
        // console.log("sendPoshmarkSoldItemsRequest called");

		isRefreshing = true;
		refreshError = '';
		clearTimeout(refreshTimeout);
		refreshTimeout = setTimeout(() => {
			isRefreshing = false;
			refreshError = 'Could not refresh Poshmark sold items. Check your Poshmark session and try again.';
		}, 120000);

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
			clearTimeout(refreshTimeout);
            // Handle response as needed
            // let poshMarkSoldItemsData = JSON.stringify(event.data.data);

			// Send the data to the page.server.ts so it can be saved to the database.
			const formData = new FormData();
			formData.append('data', JSON.stringify(event.data.data));

			try {
				const res = await fetch('/auth/poshmark-sold-items/save-poshmark-sold-items', {
					method: 'POST',
					body: formData
				});

				if (!res.ok) {
					throw new Error('Failed to save Poshmark sold items');
				}

				await invalidateAll();
				refreshError = '';
			} catch (error) {
				console.error('Failed to refresh Poshmark sold items', error);
				refreshError = 'Could not refresh Poshmark sold items. Check your Poshmark session and try again.';
			} finally {
				isRefreshing = false;
			}
		}
    }

	async function updatePurchasePrice(order: any, input: HTMLInputElement) {
		const value = input.value.trim();
		const itemId = String(order.itemId);
		if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value) || !Number.isFinite(Number(value))) {
			purchasePriceErrors[itemId] = 'Enter a valid price with up to two decimal places.';
			return;
		}

		const newValue = Number(value);
		purchasePriceErrors[itemId] = '';
		if (newValue === Number(order.purchasePrice ?? 0)) {
			input.value = formatCurrency(newValue);
			return;
		}

		const formData = new FormData();
		formData.append('itemId', order.itemId);
		formData.append('metaData', JSON.stringify({ purchasePrice: newValue }));

		purchasePriceSaving[itemId] = true;
		try {
			const response = await fetch('/auth/poshmark-sold-items?/updateItem', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) throw new Error('Failed to save purchase price');
			editableItems = editableItems.map((item: any) =>
				String(item.itemId) === itemId ? { ...item, purchasePrice: newValue } : item
			);
			input.value = formatCurrency(newValue);
		} catch (error) {
			console.error('Failed to save purchase price', error);
			purchasePriceErrors[itemId] = 'Could not save purchase price. Try again.';
		} finally {
			purchasePriceSaving[itemId] = false;
		}
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

	function openPoshmarkTab() {
		// Semd message to extension to open Poshmark tab
		window.postMessage({ type: "OPEN_POSHMARK_TAB" }, "*");
	}

	// Stop timed callbacks when navigating away
    beforeNavigate(() => {
    });

	// Clean up listeners and intervals when this component is destroyed
    onDestroy(() => {
		destroyed = true;
		clearTimeout(refreshTimeout);
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
	
	let purchasePriceErrors = $state<Record<string, string>>({});
	let purchasePriceSaving = $state<Record<string, boolean>>({});

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

<div class="auth-muted mt-2 refresh-status" role="status">
	{#if isRefreshing}Refreshing Poshmark sold items...{/if}
</div>

{#if refreshError}
	<div class="text-center mt-2" role="alert">
		{refreshError}
		{#if poshMarkTabLoggedIn}
			<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3" onclick={sendPoshmarkSoldItemsRequest}>Retry</button>
		{/if}
	</div>
{/if}

{#if editableItems == null || editableItems.length === 0}
	<div class="text-center mt-5">No sold items found.
		{#if poshMarkTabOpenButNotLoggedIn}
			<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3 mt-2" onclick={openPoshmarkTab}>
				User not logged in
			</button>
		{:else if !poshMarkTabLoggedIn}
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
				{#if poshMarkTabOpenButNotLoggedIn}
					<button type="button" class="auth-button auth-button-primary auth-button-compact ml-3 mt-2" onclick={openPoshmarkTab}>
						User not logged in
					</button>
				{:else if !poshMarkTabLoggedIn}
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
				{#each editableItems as order (order.itemId)}
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
						<td>
							<table class="auth-table auth-table-compact">
								<tbody>
									<tr>
										<td>Purchase Price:</td>
										<td>
											$<input
												type="text"
												inputmode="decimal"
												class="auth-field purchase-price-input"
												aria-label={`Purchase price for ${order.title}`}
												aria-invalid={!!purchasePriceErrors[String(order.itemId)]}
												disabled={purchasePriceSaving[String(order.itemId)]}
												value={formatCurrency(order.purchasePrice)}
												onblur={(event) => updatePurchasePrice(order, event.currentTarget)}
												onkeydown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
											/>
											{#if purchasePriceErrors[String(order.itemId)]}
												<div class="auth-negative" role="alert">{purchasePriceErrors[String(order.itemId)]}</div>
											{/if}
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
								</tbody>
							</table>
						</td>
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
	.purchase-price-input {
		width: 7rem;
		max-width: 100%;
	}

	.refresh-status {
		min-height: 1.5em;
	}

	.item-image {
		width: 100px;
		height: 100px;
	}

</style>
