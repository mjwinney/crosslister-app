<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CurrencyInput from '@canutin/svelte-currency-input';
	import { onDestroy, onMount } from 'svelte';
	import { REPORT_PERIODS, buildReportTotals, formatMoney, formatSaleDate } from '$lib/reports';
	import { poshmarkTabLoggedInUid, poshmarkTabOpen } from '$lib/stores/poshmark';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let refreshing = $state(false);
	let refreshRequested = $state(false);
	let refreshMessage = $state('');
	let refreshError = $state('');
	let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
	let cogsByItem = $state<Record<string, number | undefined>>({});
	let savedCogs: Record<string, number | undefined> = {};

	$effect(() => {
		const initial: Record<string, number | undefined> = {};
		for (const line of data.lines) initial[line.itemId] = line.cogs ?? undefined;
		cogsByItem = { ...initial };
		savedCogs = initial;
	});

	const lines = $derived(
		data.lines.map((line) => {
			const cogs = cogsByItem[line.itemId] ?? null;
			return { ...line, cogs, missingCogs: !cogs };
		})
	);
	const totals = $derived(buildReportTotals(lines));

	onMount(() => window.addEventListener('message', handlePoshmarkSoldItemsResponse));

	onDestroy(() => {
		clearTimeout(refreshTimeout);
		if (typeof window !== 'undefined') {
			window.removeEventListener('message', handlePoshmarkSoldItemsResponse);
		}
	});

	$effect(() => {
		if (refreshRequested && $poshmarkTabOpen && $poshmarkTabLoggedInUid) {
			sendPoshmarkSoldItemsRequest();
		}
	});

	function requestRefresh() {
		refreshError = '';
		refreshMessage = '';
		refreshRequested = true;
		refreshing = true;
		clearTimeout(refreshTimeout);
		refreshTimeout = setTimeout(() => {
			refreshing = false;
			refreshRequested = false;
			refreshError = 'Could not refresh Poshmark sales. Check your Poshmark session and try again.';
		}, 120000);

		if (!$poshmarkTabOpen || !$poshmarkTabLoggedInUid) {
			refreshMessage = 'Waiting for a logged-in Poshmark tab...';
			window.postMessage({ type: 'OPEN_POSHMARK_TAB' }, '*');
		}
	}

	function sendPoshmarkSoldItemsRequest() {
		refreshRequested = false;
		refreshMessage = 'Refreshing Poshmark sales...';
		window.postMessage({ type: 'IMPORT_POSHMARK_SOLD_ITEMS', daysBack: data.daysToGoBack }, '*');
	}

	async function handlePoshmarkSoldItemsResponse(event: MessageEvent) {
		if (event.data?.type !== 'POSHMARK_SOLD_DATA') return;

		clearTimeout(refreshTimeout);
		const importedCount = Array.isArray(event.data.data) ? event.data.data.length : 0;
		const formData = new FormData();
		formData.append('data', JSON.stringify(event.data.data ?? []));

		try {
			const response = await fetch('/auth/poshmark-sold-items/save-poshmark-sold-items', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) throw new Error('Failed to save Poshmark sales');

			await invalidateAll();
			refreshMessage = `Imported ${importedCount} sale(s).`;
			refreshError = '';
		} catch (error) {
			console.error('Failed to refresh Poshmark sales', error);
			refreshError = 'Could not save refreshed Poshmark sales. Try again.';
		} finally {
			refreshing = false;
		}
	}

	async function saveCogs(itemId: string) {
		const value = cogsByItem[itemId];
		if (value === null || value === undefined || value === savedCogs[itemId]) return;

		const formData = new FormData();
		formData.append('itemId', itemId);
		formData.append('metaData', JSON.stringify({ purchasePrice: value }));

		const response = await fetch('/auth/poshmark-sold-items?/updateItem', { method: 'POST', body: formData });
		if (response.ok) savedCogs[itemId] = value;
	}
</script>

<svelte:head>
	<title>{data.title} | Poshmark sales report</title>
</svelte:head>

<header class="report-header">
	<div>
		<h2 class="mb-0">Poshmark sales report</h2>
		<p class="subtitle">{data.title}</p>
		<p class="subtitle timezone-note">Dates shown in {data.timeZone}.</p>
	</div>

	<div class="controls">
		<select
			aria-label="Report period"
			value={data.period}
			onchange={(event) =>
				goto(resolve('/auth/poshmark-reports') + `?period=${event.currentTarget.value}`, {
					keepFocus: true,
					noScroll: true
				})}
		>
			{#each REPORT_PERIODS as period (period.value)}
				<option value={period.value}>{period.label}</option>
			{/each}
		</select>

		<button type="button" onclick={requestRefresh} disabled={refreshing}>
			{refreshing ? 'Refreshing...' : 'Refresh data'}
		</button>
		<button type="button" onclick={() => window.print()}>Print</button>
		<a href={resolve('/auth/poshmark-reports/pdf') + `?period=${data.period}`} data-sveltekit-reload download>Download PDF</a>
	</div>
</header>

<div class="status">
	<p>Refresh imports recent sales from your logged-in Poshmark tab.</p>
	{#if refreshMessage}<p>{refreshMessage}</p>{/if}
	{#if refreshError}<p class="error" role="alert">{refreshError}</p>{/if}
	{#if totals.missingCogsCount > 0}
		<p class="warning">
			{totals.missingCogsCount} item(s) have no purchase price (COGS) and are highlighted in red.
		</p>
	{/if}
</div>

{#if data.lines.length === 0}
	<p class="empty">No sales found for this period. Click Refresh data to import from Poshmark.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th>Date of sale</th>
				<th>Item</th>
				<th class="num">Sales</th>
				<th class="num">COGS</th>
				<th class="num">Poshmark fees</th>
			</tr>
		</thead>
		<tbody>
			{#each lines as line (line.itemId + line.soldTime.toISOString())}
				<tr class:missing={line.missingCogs}>
					<td>{formatSaleDate(line.soldTime, data.timeZone)}</td>
					<td>{line.title}</td>
					<td class="num">{formatMoney(line.sales)}</td>
					<td
						class="num cogs-cell"
						onfocusout={() => saveCogs(line.itemId)}
						onkeydown={(event) => {
							if (event.key === 'Enter') event.currentTarget.querySelector('input')?.blur();
						}}
					>
						<CurrencyInput
							bind:value={cogsByItem[line.itemId]}
							currency="USD"
							locale="en-US"
							isNegativeAllowed={false}
							inputClasses={{
								unformatted: 'auth-field',
								formatted: 'auth-field',
								formattedPositive: 'auth-field',
								formattedNegative: 'auth-field'
							}}
						/>
					</td>
					<td class="num">{formatMoney(line.fees)}</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<th>Total</th>
				<th>{data.totals.count} item(s)</th>
				<th class="num">{formatMoney(totals.sales)}</th>
				<th class="num">{formatMoney(totals.cogs)}</th>
				<th class="num">{formatMoney(totals.fees)}</th>
			</tr>
		</tfoot>
	</table>
{/if}

<style>
	.report-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.report-header h2 {
		margin: 0;
		font-size: clamp(1.35rem, 2vw, 1.8rem);
		letter-spacing: 0;
	}

	.subtitle {
		margin: 0;
		opacity: 0.7;
	}

	.timezone-note {
		font-size: 0.85rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.controls select {
		border: 1px solid var(--panel-border);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		background: var(--panel-strong);
		color: var(--text);
		font: inherit;
		line-height: 1.25;
	}

	.controls :is(button, a) {
		border: 1px solid var(--panel-border);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		background: var(--panel-strong);
		color: var(--text);
		font: inherit;
		line-height: 1.25;
		text-decoration: none;
		cursor: pointer;
		transition: background-color 120ms ease, border-color 120ms ease;
	}

	.controls :is(button, a):hover:not(:disabled) {
		border-color: var(--primary-2);
		background: rgba(34, 211, 238, 0.12);
	}

	.controls :is(button, a):focus-visible {
		outline: 2px solid var(--primary-2);
		outline-offset: 2px;
	}

	.controls button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	:global(html[data-theme='light']) .controls :is(button, a, select) {
		border-color: rgba(100, 116, 139, 0.6);
		background: #ffffff;
		color: #0f172a;
	}

	:global(html[data-theme='light']) .controls :is(button, a):hover:not(:disabled) {
		border-color: #0284c7;
		background: #f0f9ff;
	}

	:global(html[data-theme='light']) .controls :is(button, a):focus-visible {
		outline-color: #0284c7;
	}

	.status p {
		margin: 0.25rem 0;
	}

	.error {
		color: #c62828;
	}

	.warning {
		color: #b26a00;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
	}

	th,
	td {
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid rgba(128, 128, 128, 0.3);
		text-align: left;
	}

	tbody tr {
		background: var(--auth-surface);
	}

	tbody tr:nth-child(even) {
		background: var(--auth-surface-hover);
	}

	.num {
		text-align: right;
	}

	.cogs-cell :global(input) {
		width: 7rem;
		text-align: right;
	}

	tfoot th {
		border-top: 2px solid rgba(128, 128, 128, 0.5);
	}

	tr.missing td {
		background: rgba(220, 38, 38, 0.15);
		color: rgba(185, 28, 28, 1);
	}

	@media print {
		:global(.nav-shell),
		:global(.sidebar-panel),
		:global(.busy-overlay) {
			display: none !important;
		}

		:global(.grid:has(> .sidebar-panel)) {
			display: block !important;
		}

		:global(main),
		:global(.auth-app),
		:global(.items-container) {
			background: #fff !important;
			color: #000 !important;
		}

		:global(.items-container::before) {
			display: none;
		}

		select,
		button,
		a,
		.status {
			display: none !important;
		}

		table {
			font-size: 11pt;
		}

		tfoot {
			display: table-row-group;
		}

		tr.missing td {
			background: rgba(220, 38, 38, 0.08);
		}
	}
</style>