<script lang="ts">
	import { page } from '$app/state';
	import '../app.css';
	import NavBar from '../components/NavBar.svelte';
	import Register from '../components/Register.svelte';
	import Signin from '../components/Signin.svelte';
	import { closeAuthModal, openAuthModal } from '$lib/auth-modal';

	let { children } = $props();

	function handleAuthSwitch(event: CustomEvent<'signin' | 'register'>) {
		openAuthModal(event.detail);
	}
</script>

{#if page.url.pathname !== '/'}
	<NavBar />
{/if}
<Signin on:close={closeAuthModal} on:switch={handleAuthSwitch} />
<Register on:close={closeAuthModal} on:switch={handleAuthSwitch} />
{@render children()}
