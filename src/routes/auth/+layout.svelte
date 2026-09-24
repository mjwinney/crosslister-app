<script lang="ts">
	import { navigating } from '$app/state';
	import PoshmarkTabWatcher from '$lib/components/PoshmarkTabWatcher.svelte';
	import NavSideBar from '../../components/NavSideBar.svelte';
	import { appTheme } from '$lib/stores/theme';

	let { children } = $props();
</script>

<div class="auth-app" data-theme={$appTheme}>
	<PoshmarkTabWatcher />
	<NavSideBar children={children} />
</div>

{#if navigating && (navigating.to?.url.pathname === '/auth/sold-items' ||
navigating.to?.url.pathname === '/auth/active-items' ||
navigating.to?.url.pathname === '/auth/unsold-items' ||
navigating.to?.url.pathname === '/auth/dashboard' ||
navigating.to?.url.pathname === '/auth/scheduled-items' ||
navigating.to?.url.pathname === '/auth/poshmark-dashboard' ||
navigating.to?.url.pathname === '/auth/poshmark-sold-items')}
    <!-- full-screen busy overlay shown during client-side navigation to active-items -->
    <div class="busy-overlay" aria-hidden={!navigating}>
        <div class="text-center">
            <div class="spinner-border text-light" role="status" style="width:3rem; height:3rem;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2 text-light">Loading…</div>
        </div>
    </div>
{/if}

<style>
    .busy-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999; /* ensure overlay is on top */
        pointer-events: all;
    }
    .busy-overlay .text-light { color: #fff !important; }

    .auth-app {
        min-height: 100vh;
        background: radial-gradient(circle at 8% 0%, rgba(124, 58, 237, 0.14), transparent 26rem),
            linear-gradient(135deg, #040b14 0%, #0a1628 48%, #07111f 100%);
        color: #e2e8f0;
    }

    :global(html[data-theme='light']) .auth-app {
        background: radial-gradient(circle at 8% 0%, rgba(99, 102, 241, 0.1), transparent 26rem),
            linear-gradient(135deg, #f8fafc 0%, #e2e8f0 48%, #dbeafe 100%);
        color: #0f172a;
    }
</style>