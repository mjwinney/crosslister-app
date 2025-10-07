<script lang="ts">
    import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";
    import { onMount } from "svelte";

    onMount( async () => {
        const session = await authClient.getSession();
        // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
        if (!session || !session?.data) {
            goto('/');
        }
    });
    export let data;
</script>

<ul>
{#each data.post as item}
    <h2>Inventory Items for SKU: {item.sku}</h2>
    <h2>JSON: {JSON.stringify(item)}</h2>
    <li>Description: {item.data.listingDescription}</li>
{/each}
</ul>
