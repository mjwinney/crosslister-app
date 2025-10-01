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
<!-- <h1>Items</h1> -->

<!-- {#if data.post}
   <p>GOT data.post</p>
{:else}
   <p>NOT data.post</p>
{/if}

{#if data.post.data.inventoryItems}
   <p>GOT data.post.data.inventoryItems</p>
{:else}
   <p>NOT data.post.data.inventoryItems</p>
{/if} -->

<!-- <pre>{JSON.stringify(data, null, 2)}</pre> -->
{#if data.post.data.inventoryItems.length !== 0}
    <h2>Inventory Items</h2>
    <ul>
        {#each data.post.data.inventoryItems as item}
            <li>{item.sku} - {item.product.title}</li>
        {/each}
    </ul>
{/if}
