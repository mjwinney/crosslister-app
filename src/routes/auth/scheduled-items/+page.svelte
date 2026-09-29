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
			<div class="auth-spinner" role="status">
				<span class="sr-only">Loading...</span>
            </div>
			<div class="mt-2 overlay-label">Loading…</div>
        </div>
    </div>
{/if}

 <div class="items-container">
	<div class="items-header mb-3">
		<h2>Active Items ({totalItems})</h2>
		<div class="auth-muted">
			Showing {currentPage} of {totalNumberOfPages} pages
		</div>
	</div>
	<table class="auth-table mb-4">
		<tbody>
			{#each editableItems.Item as item}
				<tr>
					<td>
						<div class="flex items-center justify-center p-3">
							<img
								src={item.PictureDetails.GalleryURL}
								class="border item-image"
								alt={item.Title}
							/>
						</div>
					</td>
					<td>
						<p class="item-title text-base m-0">{item.Title}</p>
						<p class="auth-muted text-sm m-0">Item ID: {item.ItemID}</p>
						<p class="auth-positive text-sm m-0">${item.SellingStatus.CurrentPrice}</p>
					</td>
					<td>
						<div class="field-group" onfocusout={() => handleOnblur(item.ItemID, item.Metadata)}>
							<label for="originalPrice">Purchase Price</label>
							<CurrencyInput
								bind:value={item.Metadata.purchasePrice}
								currency="USD"
								locale="en-US"
								inputClasses={
									{
										unformatted: "auth-field",
										formatted: "auth-field",
										formattedPositive: "auth-field",
										formattedNegative: "auth-field",
									}
								}
						/>
						</div>
					</td>
					<td>
						<div class="field-group">
							<label for="originalPrice">Purchase Date</label>
							<DatePicker bind:selectedDate={item.Metadata.purchaseDate} on:blur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>
					</td>
					<td>
						<div class="field-group">
							<label for="purchaseLocation">Purchase Location</label>
							<input type="text" class="auth-field" bind:value={item.Metadata.purchaseLocation} onblur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>
					</td>
					<td>
						<div class="field-group">
							<label for="storageLocation">Storage Location</label>
							<input type="text" class="auth-field" bind:value={item.Metadata.storageLocation} onblur={() => handleOnblur(item.ItemID, item.Metadata)} />
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="my-3 flex justify-center">
		<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
	</div>
</div>

<style>
	.item-image {
		width: 75px;
		height: 75px;
	}
</style>
