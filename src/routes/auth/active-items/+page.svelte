<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onDestroy, onMount, tick } from 'svelte';
    import CurrencyInput from '@canutin/svelte-currency-input';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import CrosslistMenu from '$lib/components/CrosslistMenu.svelte';
	import type { MetaDataModel } from '$lib/server/DatabaseUtils.js';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import PoshLogo from '$lib/assets/Poshmark-Logo-Emblem-Color.png';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);
	let poshMarkTabExists = $state(false);
	let poshMarkTabLoggedInUid = $state("");
	let poshMarkTabLoggedIn = $derived(poshMarkTabExists && poshMarkTabLoggedInUid !== "");
	let interval: NodeJS.Timeout;
	let initialized = false;

	onMount(() => {
		if (initialized) return;
		initialized = true;

		const session = authClient.getSession();
		session.then((sess) => {
			if (!sess || !sess?.data) {
				goto('/homepage');
			}
		});

		clearInterval(interval);
		checkPoshmarkTabStatus();
		interval = setInterval(checkPoshmarkTabStatus, 5000);
		window.addEventListener("message", handlePoshmarkTabResponse);
		window.addEventListener("message", handlePoshmarkLoggedInResponse);
	});

// action handlers
async function crosslistTo(market: string, itemID: string) {
	console.log('Crosslist request:', market, itemID);
}

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
		postMetaData(itemID, metaData);
	}

	function checkPoshmarkTabStatus() {
		window.postMessage({ type: "CHECK_POSHMARK_TAB" }, "*");
	}

	function checkPoshmarkTabLoginStatus() {
		console.log("Checking Poshmark login tab status");
		window.postMessage({ type: "CHECK_POSHMARK_TAB_USER_LOGGED_IN" }, "*");
	}

	function openPoshmarkTab() {
		window.postMessage({ type: "OPEN_POSHMARK_TAB" }, "*");
	}

	function handlePoshmarkTabResponse(event: MessageEvent) {
		if (event.data?.type === "CHECK_POSHMARK_TAB_RESPONSE") {
			console.log("Received CHECK_POSHMARK_TAB_RESPONSE from Poshmark data:", event.data.data);
			poshMarkTabExists = event.data.data;
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

	beforeNavigate(() => {
		clearInterval(interval);
	});

	onDestroy(() => {
		clearInterval(interval);
		if (typeof window !== 'undefined') {
			window.removeEventListener("message", handlePoshmarkTabResponse);
			window.removeEventListener("message", handlePoshmarkLoggedInResponse);
		}
		initialized = false;
	});

    async function handlePageChange(newPage: number) {

		isLoading = true;

		currentPage = newPage;
		const path = location.pathname;
        await goto(`?page=${newPage}`, { replaceState: true });
		await invalidateAll();
        await tick();
		const container = document.querySelector('.items-container') as HTMLElement | null;

		if (container) {
			container.scrollTo({ top: 0, behavior: 'smooth' });
		} else if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}

		isLoading = false;
    }

	// Figure out pagination
	let { data } = $props();

	let dataItems = $derived(data.post.GetMyeBaySellingResponse.ActiveList.ItemArray);
	let editableItems = $state(dataItems);

	$effect(() => {
  		editableItems = dataItems;
	});

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(data.post.GetMyeBaySellingResponse.ActiveList.PaginationResult.TotalNumberOfEntries);
	let totalNumberOfPages = $derived(data.post.GetMyeBaySellingResponse.ActiveList.PaginationResult.TotalNumberOfPages);

	let marketplaces = $derived([
		{
			id: 'poshmark',
			name: 'Poshmark',
			enabled: poshMarkTabExists && poshMarkTabLoggedIn,
			warning: !poshMarkTabLoggedIn || !poshMarkTabExists,
			warningText: !poshMarkTabExists ? 'Open Poshmark tab first' : 'Please login to Poshmark'
		},
		{ id: 'etsy', name: 'Etsy', enabled: false },
		{ id: 'mercari', name: 'Mercari', enabled: false },
		{ id: 'depop', name: 'Depop', enabled: false },
	]);

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
	<div class="items-list">
		{#each editableItems.Item as item}
			<div class="item-row d-flex align-items-start p-2 border-bottom">
				<div class="col-image me-3 d-flex align-items-center justify-content-center p-3">
					<img
						src={item.PictureDetails.GalleryURL}
						class="border item-image"
						alt={item.Title}
					/>
				</div>

				<div class="col-info me-3">
					<p class="card-title fs-6 mb-0">{item.Title}</p>
					<p class="card-text text-muted fs-6 mb-0">Item ID: {item.ItemID}</p>
					<p class="mb-0 fs-6 text-success">${formatCurrency(item.SellingStatus.CurrentPrice)}</p>
				</div>

				<div class="col-right d-flex flex-column ms-auto">
					<div class="row-fields d-flex">
						<div class="col-field me-3" onfocusout={() => handleOnblur(item.ItemID, item.Metadata)}>
							<label>Purchase Price</label>
							<CurrencyInput
								bind:value={item.Metadata.purchasePrice}
								currency="USD"
								locale="en-US"
								inputClasses={{
									unformatted: "form-control",
									formatted: "form-control",
									formattedPositive: "form-control",
									formattedNegative: "form-control",
								}}
							/>
						</div>

						<div class="col-field me-3">
							<label>Purchase Date</label>
							<DatePicker bind:selectedDate={item.Metadata.purchaseDate} on:blur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>

						<div class="col-field me-3">
							<label>Purchase Location</label>
							<input type="text" class="form-control" bind:value={item.Metadata.purchaseLocation} onblur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>

						<div class="col-field">
							<label>Storage Location</label>
							<input type="text" class="form-control" bind:value={item.Metadata.storageLocation} onblur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>
						<div class="col-field">
							<label>Markets</label>
							<div class="markets-images">
								{#if item.Metadata.xlistedPoshmarkItemId}
									<a class="posh-thumb posh-link" href={`https://poshmark.com/listing/${item.Metadata.xlistedPoshmarkItemId}`} target="_blank" rel="noopener noreferrer">
										<img src={PoshLogo} alt={`Poshmark ${item.Metadata.xlistedPoshmarkItemId}`} class="posh-logo" />
									</a>
								{/if}
							</div>
						</div>

						<div class="col-actions">
							<Dropdown>
								<li>
									<a class="dropdown-item submenu-trigger" href="#">Crosslist</a>
									<ul class="dropdown-menu submenu-content">
										<CrosslistMenu itemId={String(item.ItemID)} onCrosslist={crosslistTo} {marketplaces} />
									</ul>
								</li>
								<li>
									<a class="dropdown-item submenu-trigger" href="#">Delist</a>
									<ul class="dropdown-menu submenu-content">
										<p>Are you sure you want to delist this item?</p>
										<!-- <CrosslistMenu itemId={String(item.ItemID)} onCrosslist={crosslistTo} /> -->
									</ul>
								</li>
							</Dropdown>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>

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
        z-index: 9999;
        pointer-events: all;
    }
    .busy-overlay .text-light { color: #fff !important; }

    .items-container {
        max-height: calc(100vh - 120px);
        overflow-y: auto;
        padding: 1rem;
        scrollbar-width: thin;
        scrollbar-color: #888 #f1f1f1;
    }
	.item-image {
		width: 80px;
		height: 80px;
		object-fit: contain;
		background-color: #f8f9fa;
	}

	.items-list { display: block; }
	.item-row { gap: 0.75rem; flex-wrap: nowrap; overflow-x: hidden; align-items: center; }
	.col-image { flex: 0 0 80px; }
	.col-info { flex: 0 0 200px; min-width: 150px; }
	.col-info p { font-size: 1rem; margin: 0; }
	.col-field { flex: 0 0 140px; min-width: 0; }

	.col-right { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
	.row-fields { display: flex; gap: 0.75rem; flex-wrap: nowrap; overflow-x: hidden; align-items: center; width: 100%; }
	.row-fields .col-field { flex: 1 1 0; min-width: 0; }
	.row-extra { width: 100%; }

	.posh-thumb { display: flex; align-items: center; }
	.posh-thumb img { width: 120px; height: 80px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px; }

	.markets-images {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		min-height: 38px;
		padding: 0.375rem 0.5rem;
		border: 1px solid #ced4da;
		border-radius: 0.25rem;
		background: #fff;
		box-sizing: border-box;
	}
	.posh-placeholder { display: inline-flex; align-items: center; justify-content: center; width: 120px; height: 80px; background:#f1f1f1; border:1px solid #ddd; border-radius:4px; font-size:0.95rem; color:#333; }
	.posh-logo { width: 120px; height: 80px; object-fit: cover; display: block; max-width: 30px !important; max-height: 20px !important; }
	.posh-link { text-decoration: none; color: inherit; }

	.col-actions { flex: 0 0 48px; display: flex; align-items: flex-start; justify-content: center; position: relative; }

	.col-field label { display: block; font-size: 0.85rem; margin-bottom: 0.25rem; }
	.col-field .form-control,
	.col-field input,
	.col-field .currency-input,
	.col-field .svelte-currency-input { width: 100%; box-sizing: border-box; font-size: 1rem; }
	.col-field label { font-size: 1rem; }
</style>
