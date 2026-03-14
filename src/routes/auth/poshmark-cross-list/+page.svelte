<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onDestroy, onMount, tick } from 'svelte';
    import CurrencyInput from '@canutin/svelte-currency-input';
	import type { MetaDataModel } from '$lib/server/DatabaseUtils.js';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		if (initialized) return;
			initialized = true;

		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/homepage');
		}

		clearInterval(interval);

        // Run immediately
        checkPoshmarkTabStatus();
        // checkPoshmarkTabLoginStatus();

        // Then every 5 seconds
        interval = setInterval(checkPoshmarkTabStatus, 5000);

        // Register message listeners (handlers are declared at module scope)
        window.addEventListener("message", handlePoshmarkTabResponse);
        window.addEventListener("message", handlePoshmarkLoggedInResponse);
	});

	function formatCurrency(amountStr: string): string {
		const amount = parseFloat(amountStr);
		if (isNaN(amount)) {
			throw new Error("Invalid number input");
		}
		return amount.toFixed(2);
	}

	async function postMetaData(itemID: string, metaData: MetaDataModel) {
		console.log('postMetaData called:', itemID, metaData);

		const session = await authClient.getSession();
		const userId = session.data?.session.userId || '';

		const formData = new FormData();
		formData.append('itemId', itemID);
		formData.append('metaData', JSON.stringify(metaData));
		formData.append('userId', userId);

		const response = await fetch('/auth/active-items?/updateItem', {
			method: 'POST',
			body: formData
		});
	}

	function handleOnblur(itemID: string, metaData: MetaDataModel) {
		console.log('Blur event received:', itemID, metaData);
		// Write the data to the database
		postMetaData(itemID, metaData);
	}

	async function sendPoshmarkCreateItemsRequest(item: any) {
        // Send to server or extension to fetch sold items
        console.log("sendPoshmarkCreateItemsRequest called with:", JSON.stringify(item));

		// isLoading = true; // Show loading spinner while fetching data

		// Send eBay item id to server to fetch additional details 
		// and then forward to extension for creating Poshmark listing
		const formData = new FormData();
		formData.append('itemId', JSON.stringify(item.ItemID));

		const res = await fetch('/auth/poshmark-cross-list/get-ebay-item-details', {
			method: 'POST',
			body: formData
		});

		const ebayData = await res.json();

		if (!res.ok) {
			console.error('Failed to send sold items to server', JSON.stringify(ebayData));
			return {
				status: 'error',
				message: ebayData
			};
		}

		console.log('Received data from server', JSON.stringify(ebayData));

		// isLoading = false;

        window.postMessage({
			type: "CREATE_POSHMARK_LISTING",
			ebayId: item.ItemID,
			title: ebayData.itemDetails.title,
			description: ebayData.itemDetails.description,
			imageUrls: ebayData.itemDetails.pictureURL,
			condition: ebayData.itemDetails.condition,
			category: ebayData.itemDetails.category,
			price: ebayData.itemDetails.price
		}, "*");
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
        }
        initialized = false;
    });

	// Figure out pagination
	let { data } = $props();

	let dataItems = $derived(data.post.GetMyeBaySellingResponse.ActiveList.ItemArray);  // Reactive read-only; A must for pagination redraw
	let editableItems = $state(dataItems); // Local writable copy for editing

	$effect(() => {
  		editableItems = dataItems; // keep in sync when derived changes
	});

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(data.post.GetMyeBaySellingResponse.ActiveList.PaginationResult.TotalNumberOfEntries);
	let totalNumberOfPages = $derived(data.post.GetMyeBaySellingResponse.ActiveList.PaginationResult.TotalNumberOfPages);

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

 <div class="items-container">
	<div class="d-flex justify-content-between align-items-center mb-3">
		<h2>Active Items ({totalItems})</h2>
		<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		<div class="text-muted">
			Showing {currentPage} of {totalNumberOfPages} pages
		</div>
	</div>
	<!-- <div class="d-flex align-items-center">
		<button type="button" class="btn btn-primary btn-compact ms-3 mt-2" onclick={sendPoshmarkCreateItemsRequest}>
			Cross List to Poshmark
		</button>
	</div> -->
	<table class="table table-light table-striped mb-4">
		<tbody>
			{#each editableItems.Item as item}
				<tr>
					<!-- <td>{JSON.stringify(item.Metadata)}</td> -->
					<td>
						<div class="col-md-auto d-flex align-items-center justify-content-center">
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
					</td>
					<td>
						<div class="d-flex align-items-center">
							{#if poshMarkTabExists && poshMarkTabLoggedIn}
								<button type="button" class="btn btn-primary btn-compact ms-3 mt-2" onclick={() => sendPoshmarkCreateItemsRequest(item)}>
									Cross List to Poshmark
								</button>
							{:else if poshMarkTabExists && !poshMarkTabLoggedIn}
								<button type="button" class="btn btn-primary btn-compact ms-3 mt-2" onclick={openPoshmarkTab}>
									User not logged in
								</button>
							{:else}
								<button type="button" class="btn btn-primary btn-compact ms-3 mt-2" onclick={openPoshmarkTab}>
									Open POSHMARK tab
								</button>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="my-3 d-flex justify-content-center">
		<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
	</div>
</div>

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
