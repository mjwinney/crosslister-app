<script lang="ts">
	import { page } from '$app/state';
	import '../app.css';
	import NavBar from '../components/NavBar.svelte';
	import Register from '../components/Register.svelte';
	import Signin from '../components/Signin.svelte';
	import { closeAuthModal, openAuthModal } from '$lib/auth-modal';

	let { children } = $props();
	let isSigningIn = $state(false);

	function handleAuthSwitch(event: CustomEvent<'signin' | 'register'>) {
		openAuthModal(event.detail);
	}

	function handleSigninLoading(event: CustomEvent<boolean>) {
		isSigningIn = event.detail;
	}
</script>

{#if page.url.pathname !== '/'}
	<NavBar />
{/if}
<Signin on:close={closeAuthModal} on:switch={handleAuthSwitch} on:loading={handleSigninLoading} />
<Register on:close={closeAuthModal} on:switch={handleAuthSwitch} />
{@render children()}
{#if isSigningIn}
	<div
		class="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 text-slate-50 backdrop-blur-sm"
		role="status"
		aria-live="polite"
	>
		<div class="text-center">
			<div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/25 border-r-white" aria-hidden="true"></div>
			<div class="mt-2">Loading…</div>
		</div>
	</div>
{/if}
