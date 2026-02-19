<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
    import { onMount, onDestroy } from 'svelte';

	onMount(async () => {
        if (typeof window === 'undefined') return;
        if (initialized) return;
        initialized = true;

        console.log("market-place: onMount called");
        const session = await authClient.getSession();

        // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
		if (!session || !session?.data) {
			goto('/homepage');
		}

        clearInterval(interval);

        // Run immediately
        checkPoshmarkTabStatus();
        // checkPoshmarkTabLoginStatus();

        // Then every 5 seconds
        interval = setInterval(checkPoshmarkTabStatus, 5000);
        // interval = setInterval(checkPoshmarkTabLoginStatus, 5000);

        // Register message listeners (handlers are declared at module scope)
        window.addEventListener("message", handlePoshmarkTabResponse);
        window.addEventListener("message", handlePoshmarkLoggedInResponse);
        // window.addEventListener("message", handlePoshmarkSoldItemsResponse);
    });

    // Stop timed callbacks when navigating away
    beforeNavigate(() => {
        clearInterval(interval);
    });

    function checkPoshmarkTabStatus() {
        // console.log("Checking Poshmark tab");

        // Tell extension to check if it's open. When a response arrives
        // we will request the logged-in status once from the response handler.
        window.postMessage({ type: "CHECK_POSHMARK_TAB" }, "*");
    }

    function checkPoshmarkTabLoginStatus() {
        // console.log("Checking Poshmark login tab status");

        // Tell extension to check logged-in user
        window.postMessage({ type: "CHECK_POSHMARK_TAB_USER_LOGGED_IN" }, "*");
    }

    function sendPoshmarkSoldItemsRequest() {
        // Send to server or extension to fetch sold items

        console.log("sendPoshmarkSoldItemsRequest called");

        window.postMessage({ type: "IMPORT_POSHMARK_SOLD_ITEMS" }, "*");
    }

    // Named handlers so we can remove them on destroy and avoid duplicates
    function handlePoshmarkTabResponse(event: MessageEvent) {
        if (event.data?.type === "CHECK_POSHMARK_TAB_RESPONSE") {
            // console.log("Received CHECK_POSHMARK_TAB_RESPONSE from Poshmark data:", event.data.data);
            poshMarkTabExists = event.data.data;

            // If the tab exists, request the logged-in UID once
            if (poshMarkTabExists)
                checkPoshmarkTabLoginStatus();
            else
                poshMarkTabLoggedInUid = "";
        }
    }

    function handlePoshmarkLoggedInResponse(event: MessageEvent) {
        if (event.data?.type === "CHECK_POSHMARK_TAB_USER_LOGGED_IN_RESPONSE") {
            // console.log("Received CHECK_POSHMARK_TAB_USER_LOGGED_IN_RESPONSE from Poshmark data:", event.data);
            poshMarkTabLoggedInUid = event.data.uid;
        }
    }

    // function handlePoshmarkSoldItemsResponse(event: MessageEvent) {
    //     if (event.data?.type === "POSHMARK_SOLD_DATA") {
    //         console.log("Received POSHMARK_SOLD_DATA from Poshmark data:", event.data);
    //         // Handle response as needed
    //         let poshMarkSoldItemsData = JSON.stringify(event.data.data);

    //         // Send payload to server using the API post endpoint
    //         fetch('/api/poshmark-sold-items', {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify(event.data.data)
    //         })
    //         .then(async res => {
    //             if (!res.ok) throw new Error(await res.text());
    //             const json = await res.json();
    //             console.log('Imported sold items, server response:', json);
    //         })
    //         .catch(err => {
    //             console.error('Failed to send sold items to server', err);
    //         });
    //     }
    // }

    let poshMarkTabExists = $state(false);
    let poshMarkTabLoggedInUid = $state("");
    let poshMarkTabLoggedIn = $derived(poshMarkTabExists && poshMarkTabLoggedInUid !== "");
    let poshMarkSoldItemsData = $state("");
    let interval: NodeJS.Timeout;
    let initialized = false;

    // Clean up listeners and intervals when this component is destroyed
    onDestroy(() => {
        clearInterval(interval);
        if (typeof window !== 'undefined') {
            window.removeEventListener("message", handlePoshmarkTabResponse);
            window.removeEventListener("message", handlePoshmarkLoggedInResponse);
        }
        initialized = false;
    });

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
                <p>{poshMarkTabLoggedInUid == ""}</p>
                <p>{poshMarkTabLoggedInUid == undefined}</p>
                <p>${poshMarkTabLoggedInUid}</p>
                <p>${poshMarkSoldItemsData}</p>
                <div class="d-flex flex-column mb-3">
                    <div class="d-flex align-items-center mb-2">
                        {#if poshMarkTabExists}
                            <span class="text-success">POSHMARK tab open <span class="fw-bold">✓</span></span>
                        {:else}
                            <span class="text-danger">POSHMARK tab open <span class="fw-bold">✗</span></span>
                        {/if}
                    </div>

                    <div class="d-flex align-items-center">
                        {#if poshMarkTabLoggedInUid == "" || poshMarkTabLoggedInUid == undefined}
                            <span class="text-danger">User logged in <span class="fw-bold">✗</span></span>
                        {:else}
                            <span class="text-success">User logged in <span class="fw-bold">✓</span></span>
                        {/if}
                    </div>
                </div>
                <!-- <button type="button" class="btn btn-primary" onclick={handleEbayAuth}>
                    Open POSHMARK tab
                </button> -->
                <div class="d-flex justify-content-left">
                    <button type="button" class="btn btn-primary" disabled={!poshMarkTabLoggedIn} onclick={sendPoshmarkSoldItemsRequest}>
                        import sold items
                    </button>
                </div>
			</div>
		</div>
	</div>
</div>
