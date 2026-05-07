<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { poshmarkTabOpen, poshmarkTabLoggedInUid } from '$lib/stores/poshmark';

	let interval: number;

	onMount(() => {
		// console.log('Pashmark Tab Watcher: Mounting...');

		clearInterval(interval);

		// Run immediately
		checkPoshmarkTab();

		// Poll every 5 seconds
		interval = window.setInterval(checkPoshmarkTab, 5000);

		window.addEventListener('message', handlePoshmarkResponse);
	});

	function checkPoshmarkTab() {
		// console.log('Poshmark Tab Watcher: Checking if Poshmark tab is open...');
		window.postMessage({ type: "CHECK_POSHMARK_TAB" }, "*");
	}

	function checkPoshmarkTabLoginStatus() {
		// console.log("Checking Poshmark login tab status");
		window.postMessage({ type: "CHECK_POSHMARK_TAB_USER_LOGGED_IN" }, "*");
	}

	function handlePoshmarkResponse(event: MessageEvent) {
		// console.log("PoshmarkTabWatcher received message event:", event.data?.type);
		if (event.data?.type === 'CHECK_POSHMARK_TAB_RESPONSE') {
			// console.log('Received CHECK_POSHMARK_TAB_RESPONSE from Poshmark data:', event.data.data);
			let poshMarkTabExists = event.data.data;
            poshmarkTabOpen.set(poshMarkTabExists);

			if (poshMarkTabExists)
				checkPoshmarkTabLoginStatus();
			else
				poshmarkTabLoggedInUid.set("");
		}
		if (event.data?.type === "CHECK_POSHMARK_TAB_USER_LOGGED_IN_RESPONSE") {
			// console.log("Received CHECK_POSHMARK_TAB_USER_LOGGED_IN_RESPONSE from Poshmark data:", event.data);
			poshmarkTabLoggedInUid.set(event.data.uid);
		}
	}

	onDestroy(() => {
		clearInterval(interval);
		if (typeof window !== 'undefined')
			window.removeEventListener("message", handlePoshmarkResponse);
	});
</script>

<!-- This component renders nothing -->
