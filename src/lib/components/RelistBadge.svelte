<script lang="ts">
	let {
		enabled,
		daysRemaining,
		lastRelistResult
	}: {
		enabled: boolean;
		daysRemaining: number;
		lastRelistResult?: string | null;
	} = $props();

	// Only the exact success result is clean; partial successes also need attention.
	let failed = $derived(
		!!lastRelistResult?.trim() && lastRelistResult.trim().toLowerCase() !== 'success'
	);
	let label = $derived(
		failed
			? `Last automatic relist had a problem; relists in ${daysRemaining} days`
			: `Relists in ${daysRemaining} days`
	);
</script>

{#if enabled}
	<img
		src="/relist-{daysRemaining}.svg"
		class={['relist-badge', failed && 'relist-badge-failed']}
		alt={label}
		title={label}
	/>
{/if}

<style>
	.relist-badge {
		width: 22px;
		height: 22px;
	}

	.relist-badge-failed {
		/* Recolor the existing green numbered SVG, retaining its countdown. */
		filter: brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(3000%)
			hue-rotate(350deg) brightness(85%) contrast(100%);
	}
</style>
