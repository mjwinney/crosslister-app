<script lang="ts">
	import { onMount } from 'svelte';
	import { navigating } from '$app/state';
	import 'bootstrap/dist/css/bootstrap.min.css';

	onMount(async () => {
		// Dynamically import the Bootstrap JS on the client side only
	    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  	});

	import NavSideBar from "../../components/NavSideBar.svelte";

	let { children } = $props();
</script>

<NavSideBar children={children} />

{#if navigating && (navigating.to?.url.pathname === '/auth/sold-items' || 
navigating.to?.url.pathname === '/auth/active-items' ||
navigating.to?.url.pathname === '/auth/unsold-items' ||
navigating.to?.url.pathname === '/auth/dashboard')}
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
</style>