<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import { getContext, onDestroy, onMount, tick } from 'svelte';
	import CurrencyInput from '@canutin/svelte-currency-input';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import CrosslistMenu from '$lib/components/CrosslistMenu.svelte';
	import type { MetaDataModel } from '$lib/server/DatabaseUtils.js';
	import Pagination from '$lib/components/Pagination.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { page } from '$app/state';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import { poshmarkTabOpen, poshmarkTabLoggedInUid } from '$lib/stores/poshmark';
	import {
		DEFAULT_DISCOUNT_PERCENT,
		DEFAULT_MAX_DISCOUNT_PERCENT,
		MAX_DISCOUNT_PERCENT,
		getRelistDiscountFieldErrors,
		type RelistDiscountFieldErrors
	} from '$lib/relistDiscount';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);
	const routeReady = getContext<() => void>('auth-route-ready');
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
		routeReady();
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

		// The server takes the user from the session, so only the item and its metadata are sent.
		const formData = new FormData();
		formData.append('itemId', itemID);
		formData.append('metaData', JSON.stringify(metaData));

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
			relistAt: nextRelistDate,
			...(checked ? {} : {
				relistDiscountEnabled: false,
				relistDiscountBasePrice: null,
				relistDiscountLastPrice: null
			})
		};

		item.metadata = updatedMetaData;

		try {
			await postMetaData(String(item.itemId), updatedMetaData);
		} catch (error) {
			console.error('Failed to save relist setting:', error);
		}
	}

	// Text drafts per item so the user can clear/retype a field before it is validated.
	let discountDrafts = $state<Record<string, { percent?: string; max?: string }>>({});
	let discountErrors = $state<Record<string, RelistDiscountFieldErrors>>({});

	function discountPercentText(item: any): string {
		return discountDrafts[item.itemId]?.percent ?? String(item.metadata?.relistDiscountPercent ?? DEFAULT_DISCOUNT_PERCENT);
	}

	function discountMaxText(item: any): string {
		return discountDrafts[item.itemId]?.max ?? String(item.metadata?.relistDiscountMaxPercent ?? DEFAULT_MAX_DISCOUNT_PERCENT);
	}

	function handleDiscountInput(item: any, field: 'percent' | 'max', event: Event & { currentTarget: HTMLInputElement }) {
		const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, 2);
		event.currentTarget.value = digits;
		discountDrafts[item.itemId] = { ...discountDrafts[item.itemId], [field]: digits };
		if (discountErrors[item.itemId]) {
			discountErrors[item.itemId] = { ...discountErrors[item.itemId], [field]: undefined };
		}
	}

	function validateDiscountDrafts(item: any): RelistDiscountFieldErrors {
		const percentText = discountPercentText(item);
		const maxText = discountMaxText(item);
		return getRelistDiscountFieldErrors(percentText === '' ? NaN : Number(percentText), maxText === '' ? NaN : Number(maxText));
	}

	// Only the blurred field and fields the user has already edited get an error, so untouched defaults stay quiet.
	function handleDiscountBlur(item: any, field: 'percent' | 'max') {
		const result = validateDiscountDrafts(item);
		const edited = discountDrafts[item.itemId] ?? {};
		discountErrors[item.itemId] = {
			percent: field === 'percent' || edited.percent !== undefined ? result.percent : undefined,
			max: field === 'max' || edited.max !== undefined ? result.max : undefined
		};
	}

	async function handleDiscountToggle(item: any, checked: boolean, checkbox: HTMLInputElement) {
		const itemId = String(item.itemId);
		const percentText = discountPercentText(item);
		const maxText = discountMaxText(item);
		const percent = percentText === '' ? NaN : Number(percentText);
		const max = maxText === '' ? NaN : Number(maxText);

		if (checked) {
			const result = validateDiscountDrafts(item);
			if (result.percent || result.max) {
				discountErrors[itemId] = result;
				checkbox.checked = false;
				return;
			}
		}
		delete discountErrors[itemId];

		const updatedMetaData: MetaDataModel = {
			...item.metadata,
			...(checked
				? {
					relistEnabled: true,
					...(item.metadata?.relistEnabled
						? {}
						: {
							relistAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
							relistIntervalDays: 30
						})
				}
				: {}),
			relistDiscountEnabled: checked,
			relistDiscountPercent: checked ? percent : item.metadata?.relistDiscountPercent,
			relistDiscountMaxPercent: checked ? max : item.metadata?.relistDiscountMaxPercent,
			// A fresh enable recaptures the price anchors at the next relist.
			...(checked ? { relistDiscountBasePrice: null, relistDiscountLastPrice: null } : {})
		};
		item.metadata = updatedMetaData;

		try {
			await postMetaData(itemId, updatedMetaData);
		} catch (error) {
			console.error('Failed to save relist discount setting:', error);
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

	async function handleTestRelistWithPriceChange(itemID: string) {
		console.log('handleTestRelistWithPriceChange called with itemID:', itemID);
		// We need to call the relistEbayItemsWithPriceChange function from the server-side utility
		try {
			const formData = new FormData();
			formData.append('itemId', itemID);

			const response = await fetch('/auth/active-items?/relistEbayItemsWithPriceChange', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			console.log('handleTestRelistWithPriceChange result:', result);
		} catch (error) {
			console.error('Error testing relist with price change:', error);
		}
	}

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
		{#if editableItems.length !== 0}
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
			<SearchBar placeholder="Search items..." onSearch={handleSearch} onClear={handleClearSearch} />
			<div class="auth-muted">
				Showing {currentPage} of {totalNumberOfPages} pages
			</div>
		{/if}
	</div>
	{#if editableItems.length === 0}
		<div class="empty-state">
			<p class="auth-muted">No items found</p>
		</div>
	{:else}
		<div class="items-list">
			{#each editableItems as item (item.itemId)}
				<div class="item-row flex items-start border-b p-2">
					<div class="col-image mr-3 flex items-center justify-center p-3">
<!-- <input type="button" onclick={() => handleTestRelistWithPriceChange(item.itemId)} value="Relist" /> -->
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
							<div class="col-field purchase-price-field" onfocusout={() => handleOnblur(item.itemId, item.metadata)}>
								<span class="field-label">Purchase Price</span>
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
								<span class="field-label">Purchase Date</span>
								<DatePicker bind:selectedDate={item.metadata.purchaseDate} on:blur={() => handleOnblur(item.itemId, item.metadata)} />
							</div>

							<div class="col-field">
								<span class="field-label">Purchase Location</span>
								<input type="text" class="auth-field" bind:value={item.metadata.purchaseLocation} onblur={() => handleOnblur(item.itemId, item.metadata)} />
							</div>

							<div class="col-field">
								<span class="field-label">Storage Location</span>
								<input type="text" class="auth-field" bind:value={item.metadata.storageLocation} onblur={() => handleOnblur(item.itemId, item.metadata)} />
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
												<label class="flex items-center gap-2 m-0">
													<input
														type="checkbox"
														checked={!!item.metadata?.relistEnabled}
														onchange={(event) => handleRelistToggle(item, event.currentTarget.checked)}
													/>
													<span>Relist every 30 days</span>
												</label>
											</li>
											<li class="dropdown-item relist-option relist-discount">
												<label class="flex items-center gap-2 m-0">
													<input
														type="checkbox"
														checked={!!item.metadata?.relistDiscountEnabled}
														onchange={(event) => handleDiscountToggle(item, event.currentTarget.checked, event.currentTarget)}
													/>
													<span>Discount on relist</span>
												</label>
												<div class="discount-fields">
													<label class="discount-field">
														<span class="discount-label">
															{@render discountWarning(discountErrors[item.itemId]?.percent)}
															Discount %
														</span>
														<input
															type="text"
															inputmode="numeric"
															maxlength="2"
															class="auth-field"
															aria-label="Discount percent, maximum {MAX_DISCOUNT_PERCENT}"
															value={discountPercentText(item)}
															disabled={!!item.metadata?.relistDiscountEnabled}
															oninput={(event) => handleDiscountInput(item, 'percent', event)}
															onblur={() => handleDiscountBlur(item, 'percent')}
														/>
													</label>
													<label class="discount-field">
														<span class="discount-label">
															{@render discountWarning(discountErrors[item.itemId]?.max)}
															Maximum %
														</span>
														<input
															type="text"
															inputmode="numeric"
															maxlength="2"
															class="auth-field"
															aria-label="Maximum discount percent, maximum {MAX_DISCOUNT_PERCENT}"
															value={discountMaxText(item)}
															disabled={!!item.metadata?.relistDiscountEnabled}
															oninput={(event) => handleDiscountInput(item, 'max', event)}
															onblur={() => handleDiscountBlur(item, 'max')}
														/>
													</label>
												</div>
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

		<div class="my-3 flex justify-center">
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		</div>
	{/if}
</div>

{#snippet discountWarning(message: string | undefined)}
	<span class="discount-warning" class:visible={!!message} role={message ? 'img' : undefined} aria-label={message} aria-hidden={message ? undefined : 'true'}>
		&#9888;
		{#if message}
			<span class="discount-tooltip" role="tooltip">{message}</span>
		{/if}
	</span>
{/snippet}

<style>
	.items-container {
		position: relative;
		max-height: calc(100vh - 74px);
		overflow: auto;
		padding: clamp(1rem, 2vw, 2rem);
		scrollbar-width: thin;
	}
	.items-container > * { position: relative; z-index: 1; }
	.items-container > .items-header { flex-wrap: wrap; padding: 0.25rem 0 1rem; }
	.items-container h2 { font-size: clamp(1.35rem, 2vw, 1.8rem); letter-spacing: 0; }

	.item-row {
		gap: 0.75rem;
		flex-wrap: nowrap;
		min-width: 1040px;
		overflow-x: hidden;
		align-items: center;
		border-radius: 10px;
		transition: background-color 180ms ease, box-shadow 180ms ease;
	}
	.item-image { width: 80px; height: 80px; border-radius: 8px; }

	.items-list { display: flex; flex-direction: column; gap: 0.75rem; }
	.col-image { flex: 0 0 80px; }
	.col-info { flex: 0 0 200px; min-width: 150px; }
	.col-info p { font-size: 1rem; margin: 0; }
	.col-info .item-title { font-weight: 700; }
	.col-info .auth-muted { font-size: 0.85rem; }
	.col-info .auth-positive { font-weight: 700; }
	.col-field { flex: 0 0 140px; min-width: 0; }
	.col-right { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
	.row-fields { display: flex; gap: 0.75rem; flex-wrap: nowrap; overflow-x: hidden; align-items: flex-start; width: 100%; }
	.row-fields .col-field { display: flex; flex: 1 1 0; flex-direction: column; min-width: 0; }
	.row-fields .purchase-price-field { flex: 0 1 120px; width: 120px; max-width: 120px; }
	.field-label { display: block; height: 2rem; margin-bottom: 0.3rem; font-size: 0.72rem; font-weight: 700; line-height: 1rem; letter-spacing: 0.04em; text-transform: uppercase; }
	.col-field .auth-field,
	.col-field input { width: 100%; box-sizing: border-box; min-height: 38px; font-size: 0.86rem; border-radius: 6px; }
	.row-fields .purchase-price-field :global(.currencyInput),
	.row-fields .purchase-price-field :global(.currencyInput input) { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }

	.col-actions { flex: 0 0 48px; visibility: visible; align-items: flex-start; justify-content: center; position: relative; margin-top: 2.3rem; }
	.item-row:hover .col-actions, .col-actions:focus-within { visibility: visible; }
	.col-actions :global(.dropdown-trigger) { display: inline-flex; width: 35px; height: 35px; align-items: center; justify-content: center; padding: 0; font-size: 1.35rem; line-height: 1; border: 0 !important; border-radius: 7px; box-shadow: none; text-decoration: none !important; }
	.col-actions :global(.dropdown-trigger:hover), .col-actions :global(.dropdown-trigger:focus-visible) { box-shadow: 0 0 0 2px color-mix(in srgb, var(--auth-accent) 20%, transparent); text-decoration: none !important; }
	.relist-submenu { min-width: 210px; padding: 0.5rem 0.75rem; }
	.relist-option { padding: 0.25rem 0; }
	.relist-option label { width: 100%; font-size: 0.9rem; cursor: pointer; }
	.relist-discount { border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent); margin-top: 0.25rem; padding-top: 0.5rem; }
	.discount-fields { display: flex; flex-direction: column; gap: 0.35rem; margin: 0.4rem 0 0 1.6rem; }
	.discount-field { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; cursor: default; }
	.discount-field input { width: 3.5rem; min-height: 30px; text-align: right; }
	.discount-field input:disabled { background: color-mix(in srgb, currentColor 8%, transparent); border-style: dashed; color: color-mix(in srgb, currentColor 55%, transparent); font-weight: 600; cursor: not-allowed; opacity: 0.85; }
	.discount-field:has(input:disabled) .discount-label { opacity: 0.6; }
	.discount-label { display: inline-flex; align-items: center; gap: 0.3rem; }
	/* Always reserves its width so the menu does not resize when an error appears. */
	.discount-warning { position: relative; display: inline-block; width: 1rem; text-align: center; line-height: 1; color: #d97706; visibility: hidden; cursor: help; }
	.discount-warning.visible { visibility: visible; }
	.discount-tooltip { position: absolute; left: 0; bottom: calc(100% + 8px); z-index: 20; display: none; width: max-content; max-width: 14rem; padding: 0.35rem 0.55rem; border-radius: 6px; background: #1f2937; color: #fff; font-size: 0.78rem; line-height: 1.25; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); pointer-events: none; }
	.discount-tooltip::after { content: ''; position: absolute; left: 0.35rem; top: 100%; border: 6px solid transparent; border-top-color: #1f2937; }
	.discount-warning:hover .discount-tooltip { display: block; }

	@media (max-width: 900px) {
		.items-container { max-height: none; }
		.items-container > .items-header { align-items: flex-start; }
	}
	@media (max-width: 576px) {
		.items-container { padding: 1rem 0.75rem; }
		.items-container > .items-header { gap: 0.75rem; }
		.items-container h2 { width: 100%; }
	}
</style>
