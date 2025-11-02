<script lang="ts">
	import { onMount } from 'svelte';
	import 'bootstrap/dist/css/bootstrap.min.css';

	onMount(async () => {
		// Dynamically import the Bootstrap JS on the client side only
	    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  	});

	import NavBar from '../../components/NavBar.svelte';
	import NavSideBar from "../../components/NavSideBar.svelte";

	let { children } = $props();
</script>

<!-- <NavBar /> -->
<NavSideBar children={children} />
