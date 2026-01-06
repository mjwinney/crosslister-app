<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { onMount } from 'svelte';

	onMount(async () => {
        console.log("market-place: onMount called");
		const session = await authClient.getSession();
		// console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/homepage');
		}

        clearInterval(interval);

        // Run immediately
        checkPoshmarkTabStatus();

        // Then every 5 seconds
        interval = setInterval(checkPoshmarkTabStatus, 5000);

        // Listen for response of poshmark tab check
        window.addEventListener("message", (event) => {
            if (event.data.type === "CHECK_POSHMARK_TAB_RESPONSE") {
                console.log("Received CHECK_POSHMARK_TAB_RESPONSE from Poshmark data:", event.data.data);
                poshMarkTabExists = event.data.data;
            }
        });
    });

    // Stop timed callbacks when navigating away
    beforeNavigate(() => {
        clearInterval(interval);
    });

    function checkPoshmarkTabStatus() {
        console.log("Checking Poshmark tab");

        // Tell extension to check if it's open and open if not
        window.postMessage({ type: "CHECK_POSHMARK_TAB" }, "*");
    }

    function checkPoshmarkTabLoginStatus() {
        console.log("Checking Poshmark login tab status");

        // Tell extension to check if it's open and open if not
        window.postMessage({ type: "CHECK_POSHMARK_TAB" }, "*");
    }

    let poshMarkTabExists = $state(false);
    let interval: NodeJS.Timeout;

</script>

<div class="container">
	<h1>Market Places</h1>
	<p>Manage your connected market places here.</p>
	<div class="d-flex flex-wrap justify-content-left gap-4">
		<div class="card mb-4 rounded-3 shadow-sm" style="max-width: 24rem;">
			<div class="card-header py-3">
				<h4 class="my-0 fw-normal">POSHMARK</h4>
			</div>
			<div class="card-body">
                {#if poshMarkTabExists}
                    <p class="card-text">Your Poshmark tab is already open.</p>
                {:else}
                    <p class="card-text">You need to open your Poshmark tab to connect.</p>
                {/if}
                <!-- <button type="button" class="btn btn-primary" onclick={handleEbayAuth}>
                    Open POSHMARK tab
                </button> -->
			</div>
		</div>
	</div>
</div>
