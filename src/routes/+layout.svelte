<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import NavBar from '../components/NavBar.svelte';
	import Register from '../components/Register.svelte';
	import Signin from '../components/Signin.svelte';

	onMount(async () => {
		// Dynamically import the Bootstrap JS on the client side only
		// console.log('\\src\\routes\\+layout.svelte Layout onMount');
	    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  	});

	let { children } = $props();
</script>

{#if page.url.pathname !== '/'}
	<NavBar />
{/if}
<Signin />
<Register />
{@render children()}
