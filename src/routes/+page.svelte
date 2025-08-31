<script lang="ts">
	import { authClient } from "$lib/auth-client";

    // import Signin from '../components/Signin.svelte';
    // import Register from '../components/Register.svelte';
    // import { goto } from '$app/navigation';
 
    // let data = $state();
    // let ebayItems = $state();
    // let createdItem = $state();

    // async function roll() {
    //     const response = await fetch('/ebay-api/orders');
    //     data = await response.json();
    // }

    // async function fetchItems() {
    //     const response = await fetch('/ebay-api/items');
    //     if (!response.ok) {
    //         throw new Error(`Failed to fetch eBay items: ${response.statusText}`);
    //     }
    //     ebayItems = await response.json();
    // }

    // async function createItem() {
    //     const response = await fetch('/ebay-api/create-item');
    //     if (!response.ok) {
    //         throw new Error(`Failed to create eBay item: ${response.statusText}`);
    //     }
    //     createdItem = await response.json();
    // }

    // async function auth() {
    //     window.location.href = '/ebay-api/auth';
    // }

    // async function auth() {
    //     goto('/auth'); // Goto the routes/auth page
    //     // const response = await fetch('/auth'); // Goto the routes/auth page
    //     // if (!response.ok) {
    //     //     throw new Error(`Failed auth: ${response.statusText}`);
    //     // }
    // }

    /**
     * @param {{ username: string; password: string }} param0
     */
    // async function handleRegister(username: string, password: string) {
    //     console.log('Registering user:', username, password);
    //     const response = await fetch('/api/register', {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json'
    //         },
    //         body: JSON.stringify({ username, password })
    //     });
    //     if (!response.ok) {
    //         const error = await response.text();
    //         alert(`Registration failed: ${error}`);
    //     } else {
    //         alert('Registration successful!');
    //     }
    // }

    // const { data: session, refetch } = authClient.useSession();

// console.log(`HOMEPAGE session=${JSON.stringify(session)}`);
// import { authClient } from "$lib/auth-client";
// const session = authClient.useSession();
</script>

<h1>Home Page</h1>
<!-- <div>
    {#if $session}
        <div>
        <p>
            {$session?.data?.user.name}
        </p>
        <p>
            {$session?.data?.user.email}
        </p>
        <button
            on:click={async () => {
            await authClient.signOut();
            }}
        >
            Signout
        </button>
        </div>
    {:else}
        <button
        on:click={async () => {
            await authClient.signIn.social({
            provider: "github",
            });
        }}
        >
        Continue with GitHub
        </button>
    {/if}
</div> -->
<!-- <p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<p><button class="btn btn-primary" onclick={roll}>Click to roll dice</button></p>

<p>You rolled a {data?.number}</p>

<p><button class="btn btn-primary" onclick={fetchItems}>Ebay Items</button></p>
<p>Data: {JSON.stringify(ebayItems)}</p>

<p><button class="btn btn-primary" onclick={createItem}>Create Item</button></p>
<p>Data: {JSON.stringify(createdItem)}</p>

<p><button class="btn btn-primary" onclick={auth}>Auth</button></p> -->
