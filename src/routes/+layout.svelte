<script lang="ts">
//	import '../app.css';
	import '$lib/app.scss';
	import NavBar from '../components/NavBar.svelte';

	let { children } = $props();
</script>

<NavBar />

{@render children()}
