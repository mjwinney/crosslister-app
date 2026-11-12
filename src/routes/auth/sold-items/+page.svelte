<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount, tick } from 'svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/');
		}
	});

	async function updatePurchasePrice(order: any, input: HTMLInputElement) {
		const value = input.value.trim();
		const itemId = String(transactionsOf(order)[0]?.Item?.ItemID ?? '');
		if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value) || !Number.isFinite(Number(value))) {
			purchasePriceErrors[itemId] = 'Enter a valid price with up to two decimal places.';
			return;
		}

		const newValue = Number(value);
		purchasePriceErrors[itemId] = '';
		if (newValue === Number(order.Metadata?.purchasePrice ?? 0)) {
			input.value = formatCurrency(String(newValue));
			return;
		}

		const formData = new FormData();
		formData.append('itemId', itemId);
		formData.append('metaData', JSON.stringify({ purchasePrice: newValue }));

		purchasePriceSaving[itemId] = true;
		try {
			const response = await fetch('/auth/sold-items?/updateItem', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) throw new Error('Failed to save purchase price');
			editableItems = editableItems.map((item: any) =>
				String(transactionsOf(item)[0]?.Item?.ItemID ?? '') === itemId
					? { ...item, Metadata: { ...item.Metadata, purchasePrice: newValue } }
					: item
			);
			input.value = formatCurrency(String(newValue));
		} catch (error) {
			console.error('Failed to save purchase price', error);
			purchasePriceErrors[itemId] = 'Could not save purchase price. Try again.';
		} finally {
			purchasePriceSaving[itemId] = false;
		}
	}

	/**
	 * Format an ISO date (or Date) as "Mon DD YYYY", e.g. "Nov 13 2025".
	 * Returns empty string for falsy/invalid input.
	 *
	 * @param {string|Date|null|undefined} iso
	 * @returns {string}
	 */
	export function formatIsoToMonDDYYYY(iso: string | Date | null | undefined): string {
	  if (!iso) return '';
	  const date = iso instanceof Date ? iso : new Date(String(iso));
	  if (isNaN(date.getTime())) return '';
	  const month = date.toLocaleString('en-US', { month: 'short' }); // "Nov"
	  const day = date.getDate(); // 1..31 (no leading zero)
	  const year = date.getFullYear();
	  return `${month} ${day} ${year}`;
	}

	function formatCurrency(amountStr: string): string {
		if (amountStr === null || amountStr === undefined) {
			return '0.00';
		}
		const amount = parseFloat(amountStr);
		if (isNaN(amount)) {
			throw new Error("Invalid number input");
		}
		return amount.toFixed(2);
	}

	function formatCurrencyFromNumber(amount: number): string {
		return amount.toFixed(2);
	}

	// Helper to always return an array for transactions (handles single-object vs array)
	function transactionsOf(order: any) {
		const t = order?.TransactionArray?.Transaction;
		if (!t) return [];
		return Array.isArray(t) ? t : [t];
	}

	function getShippingCostInternal(order: any, transaction?: any): number {
	if (order?.IsMultiLegShipping) {
		return parseFloat(order.MultiLegShippingDetails?.SellerShipmentToLogisticsProvider?.ShippingServiceDetails?.TotalShippingCost || '0');
	}

	const tx = transaction ?? order?.TransactionArray?.Transaction;
	const actual = Array.isArray(tx) ? tx[0]?.ActualShippingCost : tx?.ActualShippingCost;
	return parseFloat(actual || '0');
}

	// Public wrapper preserved for existing callers
	function getShippingCost(order: any, transaction?: any): number {
		return getShippingCostInternal(order, transaction);
	}

	function calculateProfit(order: any, transaction?: any): string {
		const soldRaw = transaction?.TransactionPrice ?? (Array.isArray(order?.TransactionArray?.Transaction) ? order.TransactionArray.Transaction[0]?.TransactionPrice : order.TransactionArray.Transaction?.TransactionPrice);
		const sold = parseFloat(soldRaw || '0');
		const fee = parseFloat(order.finalValueFee || '0');
		const shippingCost = calculateShipping(order, transaction);
		const addFeeGeneral = parseFloat(order.addFeeGeneral || '0');
		const purchaseRaw = order.Metadata?.purchasePrice;

		if (purchaseRaw === undefined || isNaN(parseFloat(purchaseRaw))) {
			const profit = sold - fee + shippingCost - addFeeGeneral;
			return `${formatCurrency(profit.toString())}`;
		}

		const purchase = parseFloat(purchaseRaw);
		const profit = sold - purchase - fee + shippingCost - addFeeGeneral;
		return `${formatCurrency(profit.toString())}`;
	}

	function calculateShipping(order: any, transaction?: any): number {
		const sellerShippingLabelCost = parseFloat(order.shippingLabelCost || '0');
		const buyerShippingCost = getShippingCost(order, transaction);
		const profitShipping = buyerShippingCost - sellerShippingLabelCost;

		return profitShipping;
	}

	function formatShippingCalc(order: any, transaction?: any): string {
		const sellerShippingLabelCost = parseFloat(order.shippingLabelCost || '0');
		const buyerShippingCost = getShippingCost(order, transaction);

		if (buyerShippingCost === 0) {
			return `(Paid by seller)`;
		}

		return `($${formatCurrency(buyerShippingCost.toString())} - $${formatCurrency(sellerShippingLabelCost.toString())})`;
	}

	function calculateROI(order: any, transaction?: any): string {
		const profit = calculateProfit(order, transaction);
		const purchase = parseFloat(order.Metadata.purchasePrice ? order.Metadata.purchasePrice : '0');
		const roi = (Number(profit) / purchase) * 100;
		return roi.toFixed(2) + '%';
	}

	function parseISODate(isoString: string): Date {
		if (typeof isoString !== 'string') {
			throw new Error('Input must be a string in ISO format');
		}

		const date = new Date(isoString);

		if (isNaN(date.getTime())) {
			throw new Error('Invalid ISO date format');
		}

		return date;
	}

	function getDayDifference(startTime: string, endTime: string): string {

		// Calculate the difference in milliseconds
		const diffMs = parseISODate(endTime).getTime() - parseISODate(startTime).getTime();

		// Convert milliseconds to days
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		return diffDays === 1 ? `${diffDays} day` : `${diffDays} days`;
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

	let { data } = $props();

	let dataItems = $derived(data.post.GetOrdersResponse?.OrderArray);

	// Local writable copy of items so we can update UI reactively
	// ensure editableItems has a known any[] type for TS
	let editableItems = $state([] as any[]);
	$effect(() => {
		editableItems = dataItems?.Order ?? [];
	});

	let currentPage = $state(parseInt(page.url.searchParams.get('page') || '1', 10));
	let totalItems = $derived(data.post.GetOrdersResponse?.PaginationResult.TotalNumberOfEntries);
	let totalNumberOfPages = $derived(data.post.GetOrdersResponse?.PaginationResult.TotalNumberOfPages);
	
	let purchasePriceErrors = $state<Record<string, string>>({});
	let purchasePriceSaving = $state<Record<string, boolean>>({});
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

{#if dataItems == null || dataItems.length === 0}
	<div class="items-container empty-state">
		<p class="text-center mt-5">No sold items found.</p>
	</div>
{:else}
	<div class="items-container">
		<div class="items-header mb-3 gap-3">
			<h2 class="mb-0">Sold Items ({totalItems})</h2>
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
			<div class="auth-muted">
				Showing {currentPage} of {totalNumberOfPages} pages
			</div>
		</div>
		<div class="items-list">
			{#each editableItems as order}
				{#each transactionsOf(order) as transaction}
					<div class="item-row flex items-start border-b p-2">
						<div class="col-image mr-3 flex items-center justify-center p-3">
							<img
								src={order.PictureURL}
								class="border item-image"
								alt={transaction.Item.Title}
							/>
						</div>

						<div class="col-info mr-3">
							<p class="item-title text-base m-0">{transaction.Item.Title}</p>
							<p class="auth-muted text-sm m-0">Item ID: {transaction.Item.ItemID}</p>
							<p class="auth-positive text-sm m-0">${formatCurrency(transaction.TransactionPrice)}</p>
							{#if transaction.ActualShippingCost > 0}
								<p class="auth-muted text-sm m-0">Shipping: ${formatCurrencyFromNumber(getShippingCost(order, transaction))}</p>
							{:else}
								<p class="auth-muted text-sm m-0">Shipping: Paid by seller</p>
							{/if}
							<p class="auth-muted text-sm m-0">Sold: {formatIsoToMonDDYYYY(transaction.CreatedDate)}</p>
						</div>

						<div class="col-right sold-details">
							<table class="auth-table auth-table-compact">
								<tbody>
									<tr>
										<td>Purchase Price:</td>
										<td>
											$<input
												type="text"
												inputmode="decimal"
												class="auth-field purchase-price-input"
												aria-label={`Purchase price for ${transaction.Item.Title}`}
												aria-invalid={!!purchasePriceErrors[String(transactionsOf(order)[0]?.Item?.ItemID ?? '')]}
												disabled={purchasePriceSaving[String(transactionsOf(order)[0]?.Item?.ItemID ?? '')]}
												value={formatCurrency(String(order.Metadata?.purchasePrice ?? 0))}
												onblur={(event) => updatePurchasePrice(order, event.currentTarget)}
												onkeydown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
											/>
											{#if purchasePriceErrors[String(transactionsOf(order)[0]?.Item?.ItemID ?? '')]}
												<div class="auth-negative" role="alert">{purchasePriceErrors[String(transactionsOf(order)[0]?.Item?.ItemID ?? '')]}</div>
											{/if}
										</td>
									</tr>
									<tr><td>Fee:</td><td class="auth-negative">${formatCurrency(order.finalValueFee)}</td></tr>
									<tr>
										<td>Shipping:</td>
										<td class={calculateShipping(order, transaction) >= 0 ? 'auth-positive' : 'auth-negative'}>
											${formatCurrencyFromNumber(calculateShipping(order, transaction))} <span class="auth-muted">{formatShippingCalc(order, transaction)}</span>
										</td>
									</tr>
									<tr>
										<td>Promo Fee:</td>
										<td class={order.addFeeGeneral > 0 ? 'auth-negative' : 'auth-muted'}>{order.addFeeGeneral > 0 ? `$${formatCurrency(order.addFeeGeneral)}` : '---'}</td>
									</tr>
								</tbody>
							</table>
							<table class="auth-table auth-table-compact">
								<tbody>
									<tr><td>Profit:</td><td class="auth-positive">${calculateProfit(order, transaction)}</td></tr>
									<tr><td>ROI:</td><td class="auth-positive">{calculateROI(order, transaction)}</td></tr>
									<tr><td>Time To Sell:</td><td>{getDayDifference(order.StartTime, order.EndTime)}</td></tr>
								</tbody>
							</table>
						</div>
					</div>
				{/each}
			{/each}
		</div>

		<div class="my-3 flex justify-center">
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		</div>
	</div>
{/if}

<style>
	.items-container {
		padding: clamp(1rem, 2vw, 2rem);
		scrollbar-width: thin;
	}
	.items-container > * { position: relative; z-index: 1; }
	.items-container > .items-header { flex-wrap: wrap; padding: 0.25rem 0 1rem; }
	.items-container h2 { font-size: clamp(1.35rem, 2vw, 1.8rem); letter-spacing: 0; }

	.item-row {
		gap: 0.75rem;
		flex-wrap: nowrap;
		min-width: 0;
		overflow-x: hidden;
		align-items: center;
		border-radius: 10px;
		transition: background-color 180ms ease, box-shadow 180ms ease;
	}
	.item-image { width: 100px; height: 100px; border-radius: 8px; }

	.items-list { display: flex; flex-direction: column; gap: 0.75rem; }
	.col-image { flex: 0 0 124px; }
	.col-info { flex: 1 1 200px; min-width: 150px; }
	.col-info p { font-size: 1rem; margin: 0; }
	.col-info .item-title { font-weight: 700; }
	.col-info .auth-muted { font-size: 0.85rem; }
	.col-info .auth-positive { font-weight: 700; }
	.col-right { flex: 0 1 auto; min-width: 0; }
	.sold-details { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.75rem; align-items: flex-start; }
	.sold-details .auth-table { width: auto; max-width: 100%; }
	.sold-details .auth-table td:first-child { white-space: nowrap; }
	.purchase-price-input { width: 7rem; max-width: 100%; }
	.sold-details .auth-table tbody tr { transition: background-color 180ms ease; }
	.item-row:hover .sold-details .auth-table tbody tr { background: var(--auth-surface-hover); }

	@media (max-width: 900px) {
		.items-container { max-height: none; }
		.items-container > .items-header { align-items: flex-start; }
		.item-row { flex-wrap: wrap; }
		.col-info { flex: 1 1 150px; }
		.col-right { flex: 1 1 100%; }
	}
	@media (max-width: 576px) {
		.items-container { padding: 1rem 0.75rem; }
		.items-container > .items-header { gap: 0.75rem; }
		.items-container h2 { width: 100%; }
	}
</style>
