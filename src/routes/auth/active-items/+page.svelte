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
			goto('/homepage');
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
		<div class="text-muted">
			Showing {currentPage} of {totalNumberOfPages} pages
		</div>
	</div>
	<table class="table table-light table-striped mb-4">
		<tbody>
			{#each editableItems.Item as item}
				<tr>
					<!-- <td>{JSON.stringify(item.Metadata)}</td> -->
					<td>
						<div class="col-md-auto d-flex align-items-center justify-content-center p-3">
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
						<p class="mb-0 fs-6 text-success">${item.SellingStatus.CurrentPrice}</p>
					</td>
					<td>
						<div class="form-group" onfocusout={() => handleOnblur(item.ItemID, item.Metadata)}>
							<label for="originalPrice">Purchase Price</label>
							<CurrencyInput
								bind:value={item.Metadata.purchasePrice}
								currency="USD"
								locale="en-US"
								inputClasses={
									{
										unformatted: "form-control",
										formatted: "form-control",
										formattedPositive: "form-control",
										formattedNegative: "form-control",
									}
								}
						/>
						</div>
					</td>
					<td>
						<div class="form-group">
							<label for="originalPrice">Purchase Date</label>
							<DatePicker bind:selectedDate={item.Metadata.purchaseDate}/>
						</div>
					</td>
					<td>
						<div class="form-group">
							<label for="purchaseLocation">Purchase Location</label>
							<input type="text" class="form-control" bind:value={item.Metadata.purchaseLocation} onblur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>
					</td>
					<td>
						<div class="form-group">
							<label for="storageLocation">Storage Location</label>
							<input type="text" class="form-control" bind:value={item.Metadata.storageLocation} onblur={() => handleOnblur(item.ItemID, item.Metadata)} />
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
