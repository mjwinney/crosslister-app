<script lang="ts">
	import '$lib/app.scss';
	import NavBar from '../components/NavBar.svelte';
	import NavSideBar from "../components/NavSideBar.svelte";

	let { children } = $props();
</script>

<NavBar />
<NavSideBar children={children} />
