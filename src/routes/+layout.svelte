<script lang="ts">
	import '../app.css';
	import NavBar from '../components/NavBar.svelte';
	import 'bootstrap/dist/css/bootstrap.min.css';

	let { children } = $props();
</script>

<NavBar />

{@render children()}
