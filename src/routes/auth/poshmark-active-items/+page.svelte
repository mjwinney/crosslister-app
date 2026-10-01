<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onDestroy, onMount, tick } from 'svelte';
    import CurrencyInput from '@canutin/svelte-currency-input';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import CrosslistMenu from '$lib/components/CrosslistMenu.svelte';
	import type { MetaDataModel } from '$lib/server/DatabaseUtils.js';
	import Pagination from '$lib/components/Pagination.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { page } from '$app/state';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import { poshmarkTabOpen, poshmarkTabLoggedInUid } from '$lib/stores/poshmark';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);
	let poshMarkTabLoggedIn = $derived($poshmarkTabOpen && $poshmarkTabLoggedInUid !== "");
	let initialized = false;
	let searchResults = $state<any>(null);
	let searchQuery = $state<string>('');

	let { data } = $props();

	let normalizedItems = $derived(data.post?.normalizedItems ?? []);
	let totalItems = $derived(data.post?.totalItems ?? 0);
	let totalNumberOfPages = $derived(Math.max(1, Math.ceil((data.post?.totalItems ?? 0) / 20)));
	// console.log('normalizedItems:', JSON.stringify(normalizedItems));
	// console.log('Page props data:', JSON.stringify(data));
	let editableItems = $state(normalizedItems); // Local writable copy for editing
	$effect(() => {
  		editableItems = normalizedItems; // keep in sync when derived changes
	});

	onMount(() => {
		if (initialized) return;
		initialized = true;

		const session = authClient.getSession();
		session.then((sess) => {
			if (!sess || !sess?.data) {
				goto('/');
			}
		});
	});

	// action handlers
	async function crosslistTo(market: string, item: any) {
		console.log('Crosslist request:', market, item);

		if (market === 'poshmark') {
			await sendPoshmarkCreateItemsRequest(item);
		}
	}

	async function sendPoshmarkCreateItemsRequest(item: any) {
        console.log("sendPoshmarkCreateItemsRequest called with:", JSON.stringify(item));

		const marketplaceItemId = item.itemId ?? item.ItemID ?? item.sourceItem?.ItemID ?? '';
		const formData = new FormData();
		formData.append('itemId', String(marketplaceItemId));

		const res = await fetch('/auth/active-items/get-ebay-item-details', {
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

        window.postMessage({
			type: "CREATE_POSHMARK_LISTING",
			ebayId: marketplaceItemId,
			title: ebayData.itemDetails.title,
			description: ebayData.itemDetails.description,
			imageUrls: ebayData.itemDetails.pictureURL,
			condition: ebayData.itemDetails.condition,
			category: ebayData.itemDetails.category,
			price: ebayData.itemDetails.price
		}, "*");
    }

	function formatCurrency(amountStr: string): string {
		const amount = parseFloat(amountStr);
		if (isNaN(amount)) {
			throw new Error("Invalid number input");
		}
		return amount.toFixed(2);
	}

	async function postMetaData(itemID: string, metaData: MetaDataModel) {
		// console.log('postMetaData called:', itemID, metaData);

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
		// console.log('Blur event received:', itemID, metaData);
		postMetaData(itemID, metaData);
	}

	// function openPoshmarkTab() {
	// 	window.postMessage({ type: "OPEN_POSHMARK_TAB" }, "*");
	// }

	beforeNavigate(() => {
		// clearInterval(interval);
	});

	onDestroy(() => {
		initialized = false;
	});

	async function handleSearch(query: string) {
		console.log('handleSearch called with query:', query);
		searchQuery = query;
		isLoading = true;

		try {
			await goto(`?search=${encodeURIComponent(query)}&page=1`, { replaceState: true });
			await invalidateAll();
			await tick();
			const container = document.querySelector('.items-container') as HTMLElement | null;

			if (container) {
				container.scrollTo({ top: 0, behavior: 'smooth' });
			} else if (typeof window !== 'undefined') {
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}

			isLoading = false;
		} catch (error) {
			console.error('Error performing search:', error);
		} finally {
			isLoading = false;
		}
	}

	async function handleClearSearch() {
		console.log('handleClearSearch called');
		searchQuery = '';
		isLoading = true;

		try {
			await goto(`?page=1`, { replaceState: true });
			await invalidateAll();
			await tick();
			const container = document.querySelector('.items-container') as HTMLElement | null;

			if (container) {
				container.scrollTo({ top: 0, behavior: 'smooth' });
			} else if (typeof window !== 'undefined') {
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}

			isLoading = false;
		} catch (error) {
			console.error('Error clearing search:', error);
			isLoading = false;
		}
	}

    async function handlePageChange(newPage: number) {

		isLoading = true;

		currentPage = newPage;
		const searchParam = page.url.searchParams.get('search');
		const queryString = searchParam ? `?search=${encodeURIComponent(searchParam)}&page=${newPage}` : `?page=${newPage}`;
        await goto(queryString, { replaceState: true });
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
    let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
    $effect(() => {
        currentPage = parseInt(page.url.searchParams.get('page') || '1', 10);
    });

    let marketplaces = $derived([
        {
            id: 'poshmark',
            name: 'Poshmark',
            enabled: $poshmarkTabOpen && poshMarkTabLoggedIn,
            warning: !poshMarkTabLoggedIn || !$poshmarkTabOpen,
            warningText: !$poshmarkTabOpen ? 'Open Poshmark tab first' : 'Please login to Poshmark'
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
			<div class="auth-spinner" role="status">
				<span class="sr-only">Loading...</span>
            </div>
			<div class="mt-2 overlay-label">Loading…</div>
        </div>
    </div>
{/if}

 <div class="items-container">
	<div class="items-header mb-3 gap-3">
		<h2 class="mb-0">Active Items ({totalItems})</h2>
		<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		<SearchBar placeholder="Search items..." onSearch={handleSearch} onClear={handleClearSearch} />
		<div class="auth-muted">
			Showing {currentPage} of {totalNumberOfPages} pages
		</div>
	</div>
	<div class="items-list">
		{#each editableItems as item}
			<div class="item-row flex items-start border-b p-2">
				<div class="col-image mr-3 flex items-center justify-center p-3">
					<img
						src={item.imageUrl}
						class="border item-image"
						alt={item.title}
					/>
				</div>

				<div class="col-info mr-3">
					<p class="item-title text-base m-0">{item.title}</p>
					<p class="auth-muted text-sm m-0">Item ID: {item.itemId}</p>
					<p class="auth-positive text-sm m-0">${formatCurrency(item.price)}</p>
				</div>

				<div class="col-right flex-col ml-auto">
					<div class="row-fields">
						<div class="col-field" onfocusout={() => handleOnblur(item.itemId, item.metadata)}>
							<label>Purchase Price</label>
							<CurrencyInput
								bind:value={item.metadata.purchasePrice}
								currency="USD"
								locale="en-US"
								inputClasses={{
									unformatted: "auth-field",
									formatted: "auth-field",
									formattedPositive: "auth-field",
									formattedNegative: "auth-field",
								}}
							/>
						</div>

						<div class="col-field">
							<label>Purchase Date</label>
							<DatePicker bind:selectedDate={item.metadata.purchaseDate} on:blur={() => handleOnblur(item.itemId, item.metadata)} />
						</div>

						<div class="col-field">
							<label>Purchase Location</label>
							<input type="text" class="auth-field" bind:value={item.metadata.purchaseLocation} onblur={() => handleOnblur(item.itemId, item.metadata)} />
						</div>

						<div class="col-field">
							<label>Storage Location</label>
							<input type="text" class="auth-field" bind:value={item.metadata.storageLocation} onblur={() => handleOnblur(item.itemId, item.metadata)} />
						</div>
						<div class="col-field">
							<label>Markets</label>
							<div class="markets-images">
								<!-- Cross-reference IDs are intentionally not stored; itemId remains the canonical identifier. -->
							</div>
						</div>

						<div class="col-actions">
							<Dropdown>
								<li>
									<a class="dropdown-item submenu-trigger" href="#">Crosslist</a>
									<ul class="dropdown-menu submenu-content">
										<CrosslistMenu itemId={item.itemId} onCrosslist={crosslistTo} {marketplaces} item={item} />
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

	<div class="my-3 flex justify-center">
		<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
	</div>
</div>

<style>
	.item-image {
		width: 80px;
		height: 80px;
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
	.markets-images {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		min-height: 38px;
		padding: 0.375rem 0.5rem;
		border-radius: 0.25rem;
		box-sizing: border-box;
	}

	.col-actions { flex: 0 0 48px; visibility: hidden; align-items: flex-start; justify-content: center; position: relative; }
	.item-row:hover .col-actions { visibility: visible; }

	.col-field label { display: block; font-size: 0.85rem; margin-bottom: 0.25rem; }
	.col-field .auth-field,
	.col-field input,
	.col-field .currency-input,
	.col-field .svelte-currency-input { width: 100%; box-sizing: border-box; font-size: 1rem; }
	.col-field label { font-size: 1rem; }
</style>
