<script lang="ts">
	import { onMount } from 'svelte';
	import 'bootstrap/dist/css/bootstrap.min.css';

	onMount(async () => {
		// Dynamically import the Bootstrap JS on the client side only
	    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  	});

	// import 'bootstrap/dist/js/bootstrap.bundle.min.js';
	// import '$lib/app.scss';
	import NavBar from '../components/NavBar.svelte';
	import NavSideBar from "../components/NavSideBar.svelte";
	import { authClient } from '$lib/auth-client';

	// const session = authClient.getSession();

	// console.log(`Layout load function: session=${JSON.stringify(session)}`);
	
	let { children } = $props();
</script>

<NavBar />
{@render children()}

<!-- Render the sidenavbar only if user is logged in -->
<!-- {#if !session || !session?.data}
	<NavSideBar children={children} />
{/if} -->
