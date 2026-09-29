<script lang="ts">
	import { setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PoshmarkTabWatcher from '$lib/components/PoshmarkTabWatcher.svelte';
	import NavSideBar from '../../components/NavSideBar.svelte';
	import { appTheme } from '$lib/stores/theme';
	import './auth-theme.css';

	let { children } = $props();

	type NavigationPath =
		| '/auth/dashboard'
		| '/auth/active-items'
		| '/auth/scheduled-items'
		| '/auth/sold-items'
		| '/auth/unsold-items'
		| '/auth/poshmark-dashboard'
		| '/auth/poshmark-active-items'
		| '/auth/poshmark-sold-items';

	let isLoading = $state(false);
	const routeReady: () => void = () => {
		isLoading = false;
	};
	setContext('auth-route-ready', routeReady);

	async function navigateTo(path: NavigationPath) {
		isLoading = true;
		try {
			await goto(resolve(path));
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="auth-app" data-theme={$appTheme}>
	<PoshmarkTabWatcher />
	<NavSideBar {children} {navigateTo} />
	{#if isLoading}
		<div class="busy-overlay" role="status" aria-live="polite">
			<div class="text-center">
				<div class="auth-spinner" aria-hidden="true"></div>
				<div class="mt-2 overlay-label">Loading…</div>
			</div>
		</div>
	{/if}
</div>
