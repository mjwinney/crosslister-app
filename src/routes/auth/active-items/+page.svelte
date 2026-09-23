<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
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
	import PoshLogo from '$lib/assets/Poshmark-Logo-Emblem-Color.png';
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
	let editableItems = $state<any[]>([]); // Local writable copy for editing
	$effect(() => {
  		editableItems = normalizedItems; // keep in sync when derived changes
	});

	onMount(() => {
		if (initialized) return;
		initialized = true;

		const session = authClient.getSession();
		session.then((sess) => {
			if (!sess || !sess?.data) {
				goto(resolve('/'));
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

	async function handleRelistToggle(item: any, checked: boolean) {
		const nextRelistDate = checked
			? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
			: null;

		const updatedMetaData: MetaDataModel = {
			...item.metadata,
			relistEnabled: checked,
			relistIntervalDays: 30,
			relistAt: nextRelistDate
		};

		item.metadata = updatedMetaData;

		try {
			await postMetaData(String(item.itemId), updatedMetaData);
		} catch (error) {
			console.error('Failed to save relist setting:', error);
		}
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
			await goto(`${resolve('/auth/active-items')}?search=${encodeURIComponent(query)}&page=1`, { replaceState: true });
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
			await goto(`${resolve('/auth/active-items')}?page=1`, { replaceState: true });
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
		await goto(`${resolve('/auth/active-items')}${queryString}`, { replaceState: true });
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
            <div class="spinner-border text-light" role="status" style="width:3rem; height:3rem;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2 text-light">Loading…</div>
        </div>
    </div>
{/if}

 <div class="items-container">
	<div class="d-flex justify-content-between align-items-center mb-3 gap-3">
		<h2 class="mb-0">Active Items ({totalItems})</h2>
		<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		<SearchBar placeholder="Search items..." onSearch={handleSearch} onClear={handleClearSearch} />
		<div class="text-muted">
			Showing {currentPage} of {totalNumberOfPages} pages
		</div>
	</div>
	<div class="items-list">
		{#each editableItems as item (item.itemId)}
			<div class="item-row d-flex align-items-start p-2 border-bottom">
				<div class="col-image me-3 d-flex align-items-center justify-content-center p-3">
					<img
						src={item.imageUrl}
						class="border item-image"
						alt={item.title}
					/>
				</div>

				<div class="col-info me-3">
					<p class="card-title fs-6 mb-0">{item.title}</p>
					<p class="card-text text-muted fs-6 mb-0">Item ID: {item.itemId}</p>
					<p class="mb-0 fs-6 text-success">${formatCurrency(item.price)}</p>
				</div>

				<div class="col-right d-flex flex-column ms-auto">
					<div class="row-fields d-flex">
						<div class="col-field me-3" onfocusout={() => handleOnblur(item.itemId, item.metadata)}>
							<span class="field-label">Purchase Price</span>
							<CurrencyInput
								bind:value={item.metadata.purchasePrice}
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
							<span class="field-label">Purchase Date</span>
							<DatePicker bind:selectedDate={item.metadata.purchaseDate} on:blur={() => handleOnblur(item.itemId, item.metadata)} />
						</div>

						<div class="col-field me-3">
							<span class="field-label">Purchase Location</span>
							<input type="text" class="form-control" bind:value={item.metadata.purchaseLocation} onblur={() => handleOnblur(item.itemId, item.metadata)} />
						</div>

						<div class="col-field">
							<span class="field-label">Storage Location</span>
							<input type="text" class="form-control" bind:value={item.metadata.storageLocation} onblur={() => handleOnblur(item.itemId, item.metadata)} />
						</div>
						<div class="col-field">
							<span class="field-label">Markets</span>
							<div class="markets-images">
								{#if item.metadata.xlistedPoshmarkItemId}
									<a class="posh-thumb posh-link" href={`https://poshmark.com/listing/${item.metadata.xlistedPoshmarkItemId}`} target="_blank" rel="noopener noreferrer">
										<img src={PoshLogo} alt={`Poshmark ${item.metadata.xlistedPoshmarkItemId}`} class="posh-logo" />
									</a>
								{/if}
							</div>
						</div>

						<div class="col-actions">
							<Dropdown>
								<li>
									<button class="dropdown-item submenu-trigger" type="button">Crosslist</button>
									<ul class="dropdown-menu submenu-content">
										<CrosslistMenu itemId={item.itemId} onCrosslist={crosslistTo} {marketplaces} item={item} />
									</ul>
								</li>
								<li>
									<button class="dropdown-item submenu-trigger" type="button">Relist</button>
									<ul class="dropdown-menu submenu-content relist-submenu">
										<li class="dropdown-item relist-option">
											<label class="form-check d-flex align-items-center gap-2 mb-0">
												<input
													type="checkbox"
													class="form-check-input"
													checked={!!item.metadata?.relistEnabled}
													onchange={(event) => handleRelistToggle(item, event.currentTarget.checked)}
												/>
												<span>Relist every 30 days</span>
											</label>
										</li>
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
	:global(body) {
		margin: 0;
		background: #07111f;
		font-family: "Space Grotesk", "Trebuchet MS", sans-serif;
		color: #edf6ff;
	}

	.busy-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(4, 11, 20, 0.82);
		backdrop-filter: blur(5px);
		z-index: 9999;
		pointer-events: all;
	}
	.busy-overlay .text-light { color: #edf6ff !important; }

	.items-container {
		position: relative;
		max-height: calc(100vh - 74px);
		overflow: auto;
		padding: clamp(1rem, 2vw, 2rem);
		background:
			radial-gradient(circle at 8% 0%, rgba(124, 58, 237, 0.2), transparent 28rem),
			radial-gradient(circle at 92% 100%, rgba(34, 211, 238, 0.1), transparent 24rem),
			linear-gradient(135deg, #040b14 0%, #0a1628 48%, #07111f 100%);
		scrollbar-width: thin;
		scrollbar-color: rgba(124, 58, 237, 0.7) rgba(15, 23, 42, 0.75);
	}
	.items-container::before {
		position: fixed;
		inset: 0;
		background-image: linear-gradient(rgba(148, 163, 184, 0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.055) 1px, transparent 1px);
		background-size: 32px 32px;
		mask-image: radial-gradient(circle at center, black 30%, transparent 100%);
		content: '';
		pointer-events: none;
	}
	.items-container > * { position: relative; z-index: 1; }
	.items-container > .d-flex:first-child { flex-wrap: wrap; padding: 0.25rem 0 1rem; }
	.items-container h2 { color: #f8fbff; font-size: clamp(1.35rem, 2vw, 1.8rem); letter-spacing: 0; }
	.items-container .text-muted { color: #94a9c0 !important; }

	.item-row {
		gap: 0.75rem;
		flex-wrap: nowrap;
		min-width: 1040px;
		overflow-x: hidden;
		align-items: center;
		background: rgba(18, 35, 59, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.2) !important;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2) !important;
		border-radius: 10px;
		box-shadow: 0 5px 14px rgba(4, 11, 20, 0.2);
		transition: background-color 180ms ease, box-shadow 180ms ease;
	}
	.item-row:hover { background: rgba(30, 48, 76, 0.96); box-shadow: inset 3px 0 #7c3aed, 0 8px 20px rgba(4, 11, 20, 0.28); }
	.item-image { width: 80px; height: 80px; object-fit: contain; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.22) !important; border-radius: 8px; }

	.items-list { display: flex; flex-direction: column; gap: 0.75rem; }
	.col-image { flex: 0 0 80px; }
	.col-info { flex: 0 0 200px; min-width: 150px; }
	.col-info p { font-size: 1rem; margin: 0; }
	.col-info .card-title { color: #f8fbff; font-weight: 700; }
	.col-info .text-muted { color: #8da3ba !important; font-size: 0.85rem; }
	.col-info .text-success { color: #67e8f9 !important; font-weight: 700; }
	.col-field { flex: 0 0 140px; min-width: 0; }
	.col-right { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
	.row-fields { display: flex; gap: 0.75rem; flex-wrap: nowrap; overflow-x: hidden; align-items: flex-start; width: 100%; }
	.row-fields .col-field { display: flex; flex: 1 1 0; flex-direction: column; min-width: 0; }
	.field-label { display: block; height: 2rem; margin-bottom: 0.3rem; color: #8da3ba; font-size: 0.72rem; font-weight: 700; line-height: 1rem; letter-spacing: 0.04em; text-transform: uppercase; }
	.col-field .form-control,
	.col-field input { width: 100%; box-sizing: border-box; min-height: 38px; font-size: 0.86rem; color: #edf6ff; background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 6px; }
	.col-field .form-control:focus,
	.col-field input:focus { color: #fff; background: rgba(15, 23, 42, 0.92); border-color: #22d3ee; box-shadow: 0 0 0 0.18rem rgba(34, 211, 238, 0.14); }
	.col-field input::placeholder { color: #64748b; }
	:global(.col-field .form-control),
	:global(.col-field .datepicker-input) { color: #edf6ff !important; background: rgba(15, 23, 42, 0.72) !important; border-color: rgba(148, 163, 184, 0.25) !important; }
	:global(.col-field .form-control:focus),
	:global(.col-field .datepicker-input:focus) { color: #fff !important; background: rgba(15, 23, 42, 0.92) !important; border-color: #22d3ee !important; box-shadow: 0 0 0 0.18rem rgba(34, 211, 238, 0.14) !important; }

	.posh-thumb { display: flex; align-items: center; }
	.posh-thumb img { width: 120px; height: 80px; object-fit: cover; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 6px; }
	.markets-images { display: flex; gap: 0.5rem; align-items: center; min-height: 38px; padding: 0.375rem 0.5rem; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 6px; background: rgba(15, 23, 42, 0.72); box-sizing: border-box; }
	.posh-logo { width: 120px; height: 80px; object-fit: cover; display: block; max-width: 30px !important; max-height: 20px !important; }
	.posh-link { text-decoration: none; color: inherit; }

	.col-actions { flex: 0 0 48px; visibility: visible; align-items: flex-start; justify-content: center; position: relative; margin-top: 2.3rem; }
	.item-row:hover .col-actions, .col-actions:focus-within { visibility: visible; }
	.col-actions :global(.dropdown-trigger) { display: inline-flex; width: 35px; height: 35px; align-items: center; justify-content: center; padding: 0; color: #edf6ff !important; font-size: 1.35rem; line-height: 1; background: rgba(15, 36, 62, 0.82) !important; border: 0 !important; border-radius: 7px; box-shadow: none; text-decoration: none !important; }
	.col-actions :global(.dropdown-trigger:hover), .col-actions :global(.dropdown-trigger:focus-visible) { color: #fff !important; background: rgba(124, 58, 237, 0.42) !important; box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2); text-decoration: none !important; }
	.relist-submenu { min-width: 210px; padding: 0.5rem 0.75rem; }
	.relist-option { padding: 0.25rem 0; }
	.relist-option label { width: 100%; color: #dbeafe; font-size: 0.9rem; cursor: pointer; }

	:global(.pagination) { gap: 0.25rem; }
	:global(.page-link) { color: #cbd5e1; background: rgba(15, 23, 42, 0.72); border-color: rgba(148, 163, 184, 0.2); border-radius: 6px !important; }
	:global(.page-link:hover) { color: #fff; background: rgba(124, 58, 237, 0.42); border-color: rgba(124, 58, 237, 0.65); }
	:global(.page-item.active .page-link) { color: #fff; background: linear-gradient(135deg, #7c3aed, #0891b2); border-color: transparent; box-shadow: 0 5px 18px rgba(124, 58, 237, 0.28); }
	:global(.page-item.disabled .page-link) { color: #52657d; background: rgba(15, 23, 42, 0.42); border-color: rgba(148, 163, 184, 0.12); }

	:global(.dropdown-menu) { color: #dbeafe !important; background: #0d1a2d !important; border: 1px solid rgba(124, 58, 237, 0.42) !important; border-radius: 7px !important; box-shadow: 0 16px 36px rgba(4, 11, 20, 0.5), 0 0 24px rgba(124, 58, 237, 0.16) !important; }
	:global(.dropdown-menu .dropdown-item) { color: #dbeafe !important; }
	:global(.dropdown-menu .dropdown-item:hover), :global(.dropdown-menu .dropdown-item:focus) { color: #fff !important; background: rgba(124, 58, 237, 0.35) !important; }
	:global(.dropdown-menu a), :global(.dropdown-menu a:hover), :global(.dropdown-menu a:focus), :global(.dropdown-menu .dropdown-item), :global(.dropdown-menu .dropdown-item:hover), :global(.dropdown-menu .dropdown-item:focus), :global(.dropdown-menu .submenu-trigger), :global(.dropdown-menu .submenu-trigger:hover), :global(.dropdown-menu .submenu-trigger:focus) { text-decoration: none !important; }
	:global(.dropdown-menu .form-check-input) { background-color: #17263d; border-color: #64748b; }
	:global(.dropdown-menu .form-check-input:checked) { background-color: #7c3aed; border-color: #7c3aed; }
	:global(.dropdown-trigger) { color: #a5b4fc !important; }
	:global(.dropdown-trigger:hover) { color: #67e8f9 !important; }

	@media (max-width: 900px) {
		.items-container { max-height: none; }
		.items-container > .d-flex:first-child { align-items: flex-start !important; }
	}
	@media (max-width: 576px) {
		.items-container { padding: 1rem 0.75rem; }
		.items-container > .d-flex:first-child { gap: 0.75rem !important; }
		.items-container h2 { width: 100%; }
	}
</style>
