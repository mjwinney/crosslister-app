<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount, tick } from 'svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';
	import CurrencyInput from '@canutin/svelte-currency-input';
	import { fly } from 'svelte/transition';

	// show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

	onMount(async () => {
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/');
		}
		console.log(currencyInputEl); // now defined
	});

	async function updatePurchasePrice(order: any, newValue: number) {
		const session = await authClient.getSession();
		const userId = session.data?.session.userId || '';

		const formData = new FormData();
		formData.append('itemId', order.TransactionArray.Transaction.Item.ItemID);
		formData.append('metaData', JSON.stringify({ purchasePrice: newValue }));
		formData.append('userId', userId);

		await fetch('/auth/active-items?/updateItem', {
			method: 'POST',
			body: formData
		});

		// Update local data so UI reflects immediately
		editableItems = editableItems.map((it: any) =>
			String(it.TransactionArray.Transaction.Item.ItemID) === String(order.TransactionArray.Transaction.Item.ItemID)
				? { ...it, Metadata: { ...it.Metadata, purchasePrice: newValue } }
				: it
		);
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

	function startEditing(order: any, index: number) {
		const rect = itemsElements[index].getBoundingClientRect();
		dialogPos = { top: rect.top + window.scrollY, left: rect.left };

		tempPurchasePrice = order.Metadata.purchasePrice || '0';
		editingIndex = index;
	}

	async function stopEditing() {
		const idx = editingIndex;
		if (idx < 0) return;
		const order = editableItems[idx];
		const newVal = Number(tempPurchasePrice);
		editableItems = editableItems.map((it: any, i: number) =>
			i === idx ? { ...it, Metadata: { ...it.Metadata, purchasePrice: newVal } } : it
		);
		editingIndex = -1;
		await updatePurchasePrice(order, newVal);
	}

	function cancelEditing() {
		editingIndex = -1;
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
	
	// Track which item is being edited
	let tempPurchasePrice = $state(0);
	let currencyInputEl: InstanceType<typeof CurrencyInput> | null = null;

	let editingIndex = $state(-1);
	let itemsElements: HTMLElement[] = [];
	let dialogPos = $state({ top: 0, left: 0 });
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
			{#each editableItems as order, index}
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

						<div class="col-right sold-metrics" bind:this={itemsElements[index]}>
							<div class="sold-metric purchase-price">
								<span class="field-label">Purchase Price</span>
								<div class="metric-value flex items-center">
									<span>${formatCurrency(editingIndex === index ? tempPurchasePrice : (order.Metadata.purchasePrice || 0))}</span>
									<button class="icon-action ml-2" onclick={() => startEditing(order, index)} title="Edit purchase price">✏️</button>
								</div>
							</div>
							<div class="sold-metric">
								<span class="field-label">Fee</span>
								<span class="metric-value auth-negative">${formatCurrency(order.finalValueFee)}</span>
							</div>
							<div class="sold-metric">
								<span class="field-label">Shipping</span>
								{#if calculateShipping(order, transaction) >= 0}
									<span class="metric-value auth-positive">${formatCurrencyFromNumber(calculateShipping(order, transaction))} <span class="auth-muted">{formatShippingCalc(order, transaction)}</span></span>
								{:else}
									<span class="metric-value auth-negative">${formatCurrencyFromNumber(calculateShipping(order))} <span class="auth-muted">{formatShippingCalc(order, transaction)}</span></span>
								{/if}
							</div>
							<div class="sold-metric">
								<span class="field-label">Promo Fee</span>
								{#if order.addFeeGeneral > 0}
									<span class="metric-value auth-negative">${formatCurrency(order.addFeeGeneral)}</span>
								{:else}
									<span class="metric-value auth-muted">---</span>
								{/if}
							</div>
							<div class="sold-metric">
								<span class="field-label">Profit</span>
								<span class="metric-value auth-positive">${calculateProfit(order, transaction)}</span>
							</div>
							<div class="sold-metric">
								<span class="field-label">ROI</span>
								<span class="metric-value auth-positive">{calculateROI(order, transaction)}</span>
							</div>
							<div class="sold-metric">
								<span class="field-label">Time To Sell</span>
								<span class="metric-value">{getDayDifference(order.StartTime, order.EndTime)}</span>
							</div>
							<div class="sold-metric">
								<span class="field-label">Location</span>
								<span class="metric-value">{order.Metadata.storageLocation ? order.Metadata.storageLocation : 'N/A'}</span>
							</div>
						</div>
					</div>
				{/each}
			{/each}
		</div>

		<!-- Slide-in dialog -->
		{#if editingIndex !== -1}
			<div class="side-dialog shadow p-3"
				style="position:absolute; top:{dialogPos.top}px; left:{dialogPos.left}px; z-index:1000;"
				transition:fly={{ x: 200, duration: 300 }}>
				<h6>Edit Purchase Price</h6>
				<CurrencyInput
				bind:value={tempPurchasePrice}
				currency="USD"
				locale="en-US"
				inputClasses={{
					unformatted: "auth-field",
					formatted: "auth-field",
					formattedPositive: "auth-field",
					formattedNegative: "auth-field",
				}}
				/>
				<div class="mt-3 flex justify-end gap-2">
				<button class="auth-button auth-button-secondary" onclick={() => cancelEditing()}>
					Cancel
				</button>
				<button class="auth-button auth-button-primary" onclick={() => stopEditing()}>
					Save
				</button>
				</div>
			</div>
		{/if}

		<div class="my-3 flex justify-center">
			<Pagination page={currentPage} totalPages={totalNumberOfPages} onPageChange={handlePageChange} />
		</div>
	</div>
{/if}

<style>
	.items-container {
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
	.col-right { flex: 1 1 auto; min-width: 0; }
	.sold-metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		align-items: start;
	}
	.sold-metric { display: flex; min-width: 0; flex-direction: column; }
	.field-label { display: block; min-height: 2rem; margin-bottom: 0.3rem; font-size: 0.72rem; font-weight: 700; line-height: 1rem; text-transform: uppercase; }
	.metric-value { min-height: 38px; font-size: 0.86rem; line-height: 1.35; overflow-wrap: anywhere; }
	.purchase-price .metric-value { font-weight: 600; }
	.purchase-price button { min-width: 24px; }

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
