<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { REPORT_PERIODS, formatMoney, formatSaleDate } from '$lib/reports';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let refreshing = $state(false);
</script>

<svelte:head>
	<title>{data.title} | eBay sales report</title>
</svelte:head>

<header class="report-header">
	<div>
		<h1>eBay sales report</h1>
		<p class="subtitle">{data.title}</p>
		<p class="subtitle timezone-note">Dates shown in {data.timeZone}.</p>
	</div>

	<div class="controls">
		<select
			aria-label="Report period"
			value={data.period}
			onchange={(e) => goto(`?period=${e.currentTarget.value}`, { keepFocus: true, noScroll: true })}
		>
			{#each REPORT_PERIODS as period (period.value)}
				<option value={period.value}>{period.label}</option>
			{/each}
		</select>

		<form
			method="POST"
			action="?/refresh"
			use:enhance={() => {
				refreshing = true;
				return async ({ update }) => {
					await update();
					refreshing = false;
				};
			}}
		>
			<input type="hidden" name="period" value={data.period} />
			<button type="submit" disabled={refreshing}>
				{refreshing ? 'Refreshing...' : 'Refresh data'}
			</button>
		</form>

		<button type="button" onclick={() => window.print()}>Print</button>
		<a href="/auth/reports/pdf?period={data.period}" data-sveltekit-reload download>Download PDF</a>
	</div>
</header>

<div class="status">
	{#if data.lastRefreshed}
		<p>Last refreshed {new Date(data.lastRefreshed).toLocaleString()}</p>
	{:else}
		<p>Not refreshed yet. Click Refresh data to import from eBay.</p>
	{/if}

	{#if form?.message}
		<p class="error">{form.message}</p>
	{:else if form?.success}
		<p class="success">Imported {form.synced} sale(s).</p>
	{/if}

	{#if data.totals.missingCogsCount > 0}
		<p class="warning">
			{data.totals.missingCogsCount} item(s) have no purchase price (COGS) and are highlighted in red.
		</p>
	{/if}
</div>

{#if data.lines.length === 0}
	<p class="empty">No sales found for this period. Click Refresh data to import from eBay.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th>Date of sale</th>
				<th>Item</th>
				<th class="num">Sales</th>
				<th class="num">COGS</th>
				<th class="num">eBay fees</th>
				<th class="num">Shipping</th>
			</tr>
		</thead>
		<tbody>
			{#each data.lines as line (line.itemId + line.soldTime.toISOString())}
				<tr class:missing={line.missingCogs}>
					<td>{formatSaleDate(line.soldTime, data.timeZone)}</td>
					<td>{line.title}</td>
					<td class="num">{formatMoney(line.sales)}</td>
					<td class="num">{line.missingCogs ? 'Missing' : formatMoney(line.cogs ?? 0)}</td>
					<td class="num">{formatMoney(line.fees)}</td>
					<td class="num">{formatMoney(line.shipping)}</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<th>Total</th>
				<th>{data.totals.count} item(s)</th>
				<th class="num">{formatMoney(data.totals.sales)}</th>
				<th class="num">{formatMoney(data.totals.cogs)}</th>
				<th class="num">{formatMoney(data.totals.fees)}</th>
				<th class="num">{formatMoney(data.totals.shipping)}</th>
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

	.controls form {
		display: contents;
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

	.success {
		color: #2e7d32;
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

	tfoot th {
		border-top: 2px solid rgba(128, 128, 128, 0.5);
	}

	tr.missing td {
		background: rgba(220, 38, 38, 0.15);
		color: rgba(185, 28, 28, 1);
	}

	@media print {
		form,
		select,
		button,
		a,
		.status {
			display: none !important;
		}

		table {
			font-size: 11pt;
		}

		tr.missing td {
			background: rgba(220, 38, 38, 0.08);
		}
	}
</style>
