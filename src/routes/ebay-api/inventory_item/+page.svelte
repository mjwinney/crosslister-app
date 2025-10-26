<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount } from 'svelte';
    import CurrencyInput from '@canutin/svelte-currency-input';

	onMount(async () => {
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/');
		}
	});

//     export let value: number = 0; // Raw numeric value
//     export let currency: string = 'USD';
//     // export let locale: string = browser ? navigator.language : 'en-US';
//     export let locale: string = 'en-US';

//     let formattedValue: string = '';
//     let inputElement: HTMLInputElement;

//     const formatter = new Intl.NumberFormat(locale, {
//         style: 'currency',
//         currency,
//         minimumFractionDigits: 2,
//         maximumFractionDigits: 2,
//     });

//     function formatAndSetValue(newValue: number) {
//         value = newValue;
//         formattedValue = formatter.format(value);
//     }

// function handleInput(event: Event) {
//     const target = event.target as HTMLInputElement;
//     const rawInput = target.value.replace(/[^0-9.]/g, ''); // Allow only digits and one decimal
//     const numericValue = parseFloat(rawInput) || 0; // Convert to number

//     // Save and restore cursor position (more complex in a real implementation)
//     const cursorStart = target.selectionStart;
//     const cursorEnd = target.selectionEnd;

//     formatAndSetValue(numericValue);

//     // Restore cursor position (simplified)
//     // You would need to calculate the new position based on added formatting characters
//     target.setSelectionRange(cursorStart, cursorEnd);
// }

    let amount = 123.45;

    export let data;
</script>

<div class="row row-cols-1 g-4">
	{#each data.post.GetMyeBaySellingResponse.ActiveList.ItemArray.Item as item}
		<!-- Item Card Example 1 -->
		<div class="col">
			<div class="card item-card">
				<div class="row g-0">
					<div class="col-md-auto d-flex align-items-center justify-content-center p-3">
						<div class="form-check me-3">
							<input class="form-check-input" type="checkbox" value="" id="itemCheckbox1" />
							<label class="form-check-label" for="itemCheckbox1"></label>
						</div>
						<img
							src={item.PictureDetails.GalleryURL}
							class="border img-fluid item-image"
							alt={item.Title}
						/>
					</div>
					<div class="col-md">
						<div class="card-body card-body-custom">
							<form>
								<div class="row">
									<div class="col-md-3">
                                        <p class="card-title fs-6 mb-0">{item.Title}</p>
                                        <p class="card-text text-muted fs-6 mb-0">Item ID: {item.ItemID}</p>
                                        <p class="mb-0 fs-6">${item.SellingStatus.CurrentPrice}</p>
									</div>
									<div class="col-md-3">
										<div class="form-group">
                                            <label for="originalPrice">Original Price</label>
                                            <CurrencyInput bind:value={amount} currency="USD" locale="en-US" />
                                            <!-- <input type="tel" class="form-control" id="originalPrice" placeholder="0.00"> -->
										</div>
									</div>
									<div class="col-md-3">
										<div class="form-group">
											<label for="purchaseLocation">Purchase Location</label>
											<input type="text" class="form-control" id="purchaseLocation" />
										</div>
									</div>
									<div class="col-md-3">
										<div class="form-group">
											<label for="storageLocation">Storage Location</label>
											<input type="text" class="form-control" id="storageLocation" />
										</div>
									</div>
								</div>
							</form>
							<!-- <div>
                                <p class="card-title">{item.Title}</p>
                                <p class="card-text text-muted">Item ID: {item.ItemID}</p>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-1">
                                <p class="mb-0">${item.SellingStatus.CurrentPrice}</p>
                                <a href="javascript:void(0);" class="btn btn-primary btn-sm">View Item</a>
                            </div> -->
						</div>
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
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
