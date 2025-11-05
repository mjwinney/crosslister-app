<script lang="ts">
	import { goto, invalidate, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount, tick } from 'svelte';
    import CurrencyInput from '@canutin/svelte-currency-input';
	import type { MetaDataModel } from '$lib/server/DatabaseUtils.js';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	// import { url } from 'inspector';

	onMount(async () => {
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/');
		}
	});

	function isoToShortDate(isoString: string): string {
		const date = new Date(isoString);

		const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
		const day = date.getUTCDate().toString().padStart(2, '0');
		const year = date.getUTCFullYear().toString().slice(-2); // Get last two digits

		return `${month}/${day}/${year}`;
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

	function handleDateInput(event: Event, itemID: string, metaData: MetaDataModel) {
		console.log('handleDateInput event received:', itemID, metaData);
		const input = (event.target as HTMLInputElement).value;

		// Convert MM/DD/YY to ISO
		const [month, day, year] = input.split('/').map(Number);
		const fullYear = year < 100 ? 2000 + year : year;
		// const iso = new Date(Date.UTC(fullYear, month - 1, day)).toISOString();
		const iso = new Date(Date.UTC(fullYear, month - 1, day));

		metaData.purchaseDate = iso;
		// Write the data to the database
		postMetaData(itemID, metaData);	
	}

	function getDisplayDate(iso: string): string {
		if (!iso) {
			return '';
		}
		try {
			return isoToShortDate(iso);
		} catch {
			return '';
		}
	}

	function handleOnblur(itemID: string, metaData: MetaDataModel) {
		console.log('Blur event received:', itemID, metaData);
		// Write the data to the database
		postMetaData(itemID, metaData);
	}

    // Example: navigate to the same route with ?page=N
    async function handlePageChange(newPage: number) {
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
						<p class="mb-0 fs-6">${item.SellingStatus.CurrentPrice}</p>
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
							<input type="text" class="form-control" placeholder="Select date" value={getDisplayDate(item.Metadata.purchaseDate)} onblur={(e) => handleDateInput(e, item.ItemID, item.Metadata)}/>
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
    .items-container {
        max-height: calc(100vh - 120px); /* Adjust 150px based on your header/footer size */
        overflow-y: auto;
        padding: 1rem;
        /* Optional: Add a subtle scrollbar style */
        scrollbar-width: thin;
        scrollbar-color: #888 #f1f1f1;
    }
	.item-card {
		border: 1px solid #dee2e6;
		border-radius: 8px;
		overflow: hidden;
		transition: transform 0.2s ease-in-out;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}
	.item-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
	}
	.item-image {
		width: 75px;
		height: 75px;
		object-fit: contain;	
		background-color: #f8f9fa;
	}
	.card-body-custom {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.form-check-label {
		cursor: pointer;
	}
</style>
