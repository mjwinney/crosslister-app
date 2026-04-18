<script lang="ts">
	let {
		itemId,
		onCrosslist,
	}: {
		itemId: string;
		onCrosslist: (marketplace: string, itemId: string) => void;
	} = $props();

	let selectedMarketplaces = $state<string[]>([]);

	const marketplaces = [
		{ id: 'poshmark', name: 'Poshmark' },
		{ id: 'etsy', name: 'Etsy' },
		{ id: 'mercari', name: 'Mercari' },
		{ id: 'depop', name: 'Depop' },
	];

	function toggleMarketplace(id: string) {
		if (selectedMarketplaces.includes(id)) {
			selectedMarketplaces = selectedMarketplaces.filter((m) => m !== id);
		} else {
			selectedMarketplaces = [...selectedMarketplaces, id];
		}
	}

	function handleDoIt() {
		selectedMarketplaces.forEach((marketplace) => {
			onCrosslist(marketplace, itemId);
		});
		selectedMarketplaces = [];

		// Dispatch event to close dropdown
		const event = new CustomEvent('crosslist-complete', { bubbles: true });
		document.dispatchEvent(event);
	}
</script>

<li class="crosslist-menu">
	<div class="crosslist-header">Crosslist to:</div>
	<ul class="marketplace-list">
		{#each marketplaces as marketplace}
			<li>
				<label class="marketplace-item">
					<input
						type="checkbox"
						checked={selectedMarketplaces.includes(marketplace.id)}
						onchange={() => toggleMarketplace(marketplace.id)}
					/>
					<span class="marketplace-name">{marketplace.name}</span>
				</label>
			</li>
		{/each}
	</ul>
	<div class="crosslist-footer">
		<button
			class="btn btn-primary btn-sm do-it-btn"
			disabled={selectedMarketplaces.length === 0}
			onclick={handleDoIt}
		>
			Do it
		</button>
	</div>
</li>

<style>
	.crosslist-header {
		padding: 0.25rem 1rem;
		font-size: 0.75rem;
		color: #6c757d;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.marketplace-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.marketplace-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		cursor: pointer;
		font-size: 0.875rem;
		color: #212529;
	}

	.marketplace-item:hover {
		background-color: #f8f9fa;
	}

	.marketplace-item input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.crosslist-footer {
		display: flex;
		justify-content: center;
		padding: 0.5rem 1rem;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
		margin-top: 0.5rem;
	}

	.do-it-btn {
		min-width: 80px;
	}
</style>