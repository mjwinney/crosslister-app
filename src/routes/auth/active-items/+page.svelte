<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount, tick } from 'svelte';
    import CurrencyInput from '@canutin/svelte-currency-input';
	import type { MetaDataModel } from '$lib/server/DatabaseUtils.js';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import PoshLogo from '$lib/assets/Poshmark-Logo-Emblem-Color.png';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/homepage');
		}
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

	let dataItems = $derived(data.post.GetMyeBaySellingResponse.ActiveList.ItemArray);  // Reactive read-only; A must for pagination redraw
	let editableItems = $state(dataItems); // Local writable copy for editing

	$effect(() => {
  		editableItems = dataItems; // keep in sync when derived changes
	});

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(data.post.GetMyeBaySellingResponse.ActiveList.PaginationResult.TotalNumberOfEntries);
	let totalNumberOfPages = $derived(data.post.GetMyeBaySellingResponse.ActiveList.PaginationResult.TotalNumberOfPages);

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
						<div class="col-field me-3" on:focusout={() => handleOnblur(item.ItemID, item.Metadata)}>
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
							<input type="text" class="form-control" bind:value={item.Metadata.purchaseLocation} on:blur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>

						<div class="col-field">
							<label>Storage Location</label>
							<input type="text" class="form-control" bind:value={item.Metadata.storageLocation} on:blur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>
					</div>

					<div class="row-extra mt-2">
						{#if item.Metadata.xlistedPoshmarkItemId}
							<a class="posh-thumb posh-link" href={`https://poshmark.com/listing/${item.Metadata.xlistedPoshmarkItemId}`} target="_blank" rel="noopener noreferrer">
								<img src={PoshLogo} alt={`Poshmark ${item.Metadata.xlistedPoshmarkItemId}`} class="posh-logo" />
							</a>
						{/if}
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
		width: 80px;
		height: 80px;
		object-fit: contain;
		background-color: #f8f9fa;
	}

	/* Flex-based layout replacements for the former table */
	.items-list { display: block; }
	/* Keep all fields on a single row; avoid horizontal scroll by tighter sizing */
	.item-row { gap: 0.75rem; flex-wrap: nowrap; overflow-x: hidden; align-items: center; }
	.col-image { flex: 0 0 80px; }
	.col-info { flex: 0 0 200px; min-width: 150px; }
	.col-info p { font-size: 1rem; margin: 0; }
	.col-field { flex: 0 0 140px; min-width: 0; }

	/* Right column: single horizontal row of fields, with an extra row below */
	.col-right { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
	.row-fields { display: flex; gap: 0.75rem; flex-wrap: nowrap; overflow-x: hidden; align-items: center; width: 100%; }
	.row-fields .col-field { flex: 1 1 0; min-width: 0; }
	.row-extra { width: 100%; }

	/* Poshmark thumbnail / placeholder */
	.posh-thumb { display: flex; align-items: center; }
	.posh-thumb img { width: 120px; height: 80px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px; }
	.posh-placeholder { display: inline-flex; align-items: center; justify-content: center; width: 120px; height: 80px; background:#f1f1f1; border:1px solid #ddd; border-radius:4px; font-size:0.95rem; color:#333; }
	.posh-logo { width: 120px; height: 80px; object-fit: cover; display: block; max-width: 60px !important; max-height: 40px !important; }
	.posh-link { text-decoration: none; color: inherit; }

	/* Make inputs expand to fill their column */
	.col-field label { display: block; font-size: 0.85rem; margin-bottom: 0.25rem; }
	.col-field .form-control,
	.col-field input,
	.col-field .currency-input,
	.col-field .svelte-currency-input { width: 100%; box-sizing: border-box; font-size: 1rem; }
	.col-field label { font-size: 1rem; }
</style>
