<script lang="ts">
	type Marketplace = {
		id: string;
		name: string;
		enabled: boolean;
		warning?: boolean;
		warningText?: string;
	};

	let {
		itemId,
		onCrosslist,
		marketplaces,
		item,
	}: {
		itemId: string;
		onCrosslist: (marketplace: string, item: any) => void;
		marketplaces: Marketplace[];
		item?: any;
	} = $props();

	let selectedMarketplaces = $state<string[]>([]);

	function toggleMarketplace(id: string) {
		if (selectedMarketplaces.includes(id)) {
			selectedMarketplaces = selectedMarketplaces.filter((m) => m !== id);
		} else {
			selectedMarketplaces = [...selectedMarketplaces, id];
		}
	}

	function handleDoIt() {
		selectedMarketplaces.forEach((marketplace) => {
			onCrosslist(marketplace, item);
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
				<label class="marketplace-item" class:disabled={!marketplace.enabled}>
					{#if marketplace.warning}
						<span class="warning-icon">
							⚠️
							<span class="tooltip-text">{marketplace.warningText || ''}</span>
						</span>
					{/if}
					<input
						type="checkbox"
						checked={selectedMarketplaces.includes(marketplace.id)}
						onchange={() => toggleMarketplace(marketplace.id)}
						disabled={!marketplace.enabled}
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
	.crosslist-menu {
		font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	}

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
		font-size: 1rem;
		color: #212529;
	}

	.marketplace-item:hover {
		background-color: #f8f9fa;
	}

	.marketplace-item input[type='checkbox']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.warning-icon {
		cursor: help;
		font-size: 0.9rem;
		position: relative;
	}

	.tooltip-text {
		visibility: hidden;
		opacity: 0;
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		background-color: #333;
		color: #fff;
		text-align: center;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		white-space: nowrap;
		z-index: 1;
		transition: opacity 0.2s, visibility 0.2s;
	}

	.warning-icon:hover .tooltip-text {
		visibility: visible;
		opacity: 1;
	}

	.marketplace-item.disabled {
		color: #adb5bd;
		cursor: not-allowed;
	}

	.marketplace-item.disabled:hover {
		background-color: transparent;
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