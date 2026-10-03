<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount, tick } from 'svelte';
    import CurrencyInput from '@canutin/svelte-currency-input';
	import type { MetaDataModel } from '$lib/server/DatabaseUtils.js';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import { navigating } from '$app/state';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/');
		}
	});

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

	// Figure out pagination
	let { data } = $props();

	const scheduledList = $derived(data.post?.GetMyeBaySellingResponse?.ScheduledList);

	// The XML parser returns a single object (not an array) when there is only one item
	const dataItems = $derived.by(() => {
		const raw = scheduledList?.ItemArray?.Item;
		if (!raw) return [];
		return Array.isArray(raw) ? raw : [raw];
	});
	let editableItems = $state<any[]>([]);

	$effect(() => {
		editableItems = dataItems.map((item: any) => ({ ...item, Metadata: item.Metadata ?? {} }));
	});

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(scheduledList?.PaginationResult?.TotalNumberOfEntries ?? 0);
	let totalNumberOfPages = $derived(scheduledList?.PaginationResult?.TotalNumberOfPages ?? 1);

	function formatCurrency(amountStr: string | number): string {
		const amount = parseFloat(String(amountStr));
		return isNaN(amount) ? '0.00' : amount.toFixed(2);
	}

</script>

<!-- full-screen busy overlay shown during client-side navigation -->
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
		<h2 class="mb-0">Scheduled Items ({totalItems})</h2>
		{#if editableItems.length > 0}
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
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
			{#each editableItems as item (item.ItemID)}
				<div class="item-row flex items-start border-b p-2">
					<div class="col-image mr-3 flex items-center justify-center p-3">
						<img src={item.PictureDetails?.GalleryURL} class="border item-image" alt={item.Title} />
					</div>

					<div class="col-info mr-3">
						<p class="item-title text-base m-0">{item.Title}</p>
						<p class="auth-muted text-sm m-0">Item ID: {item.ItemID}</p>
						<p class="auth-positive text-sm m-0">${formatCurrency(item.SellingStatus?.CurrentPrice)}</p>
					</div>

					<div class="col-right flex-col ml-auto">
						<div class="row-fields">
							<div class="col-field purchase-price-field" onfocusout={() => handleOnblur(item.ItemID, item.Metadata)}>
								<span class="field-label">Purchase Price</span>
								<CurrencyInput
									bind:value={item.Metadata.purchasePrice}
									currency="USD"
									locale="en-US"
									inputClasses={{
										unformatted: 'auth-field',
										formatted: 'auth-field',
										formattedPositive: 'auth-field',
										formattedNegative: 'auth-field'
									}}
								/>
							</div>

							<div class="col-field">
								<span class="field-label">Purchase Date</span>
								<DatePicker bind:selectedDate={item.Metadata.purchaseDate} on:blur={() => handleOnblur(item.ItemID, item.Metadata)} />
							</div>

							<div class="col-field">
								<span class="field-label">Purchase Location</span>
								<input type="text" class="auth-field" bind:value={item.Metadata.purchaseLocation} onblur={() => handleOnblur(item.ItemID, item.Metadata)} />
							</div>

							<div class="col-field">
								<span class="field-label">Storage Location</span>
								<input type="text" class="auth-field" bind:value={item.Metadata.storageLocation} onblur={() => handleOnblur(item.ItemID, item.Metadata)} />
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

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		font-size: 1.25rem;
	}

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