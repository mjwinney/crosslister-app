<script lang="ts">
	import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";

    onMount( async () => {
        const session = await authClient.getSession();
        // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
        if (!session || !session?.data) {
            goto('/homepage');
        }
	});

	function handleEbayAuth() {
        goto('/auth/ebay-auth');
	};

</script>

<h1>Market Places</h1>
<p>Manage your connected market places here.</p>
<!-- create a button that takes me to the ebay auth page -->
<button type="button" class="btn btn-primary" onclick="{handleEbayAuth}">
    Connect eBay Account
</button>
