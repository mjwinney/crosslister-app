<script lang="ts">
    import Signin from '../components/Signin.svelte';
    import Register from '../components/Register.svelte';
 
    let data = $state();
    let ebayItems = $state();
    let createdItem = $state();

    async function roll() {
        const response = await fetch('/ebay-api/orders');
        data = await response.json();
    }

    async function fetchItems() {
        const response = await fetch('/ebay-api/items');
        if (!response.ok) {
            throw new Error(`Failed to fetch eBay items: ${response.statusText}`);
        }
        ebayItems = await response.json();
    }

    async function createItem() {
        const response = await fetch('/ebay-api/create-item');
        if (!response.ok) {
            throw new Error(`Failed to create eBay item: ${response.statusText}`);
        }
        createdItem = await response.json();
    }

    // async function auth() {
    //     window.location.href = '/ebay-api/auth';
    // }

    async function auth() {
        const response = await fetch('/ebay-api/auth');
        if (!response.ok) {
            throw new Error(`Failed auth: ${response.statusText}`);
        }
    }

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
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<p><button class="btn btn-primary" onclick={roll}>Click to roll dice</button></p>

<p>You rolled a {data?.number}</p>

<p><button class="btn btn-primary" onclick={fetchItems}>Ebay Items</button></p>
<p>Data: {JSON.stringify(ebayItems)}</p>

<p><button class="btn btn-primary" onclick={createItem}>Create Item</button></p>
<p>Data: {JSON.stringify(createdItem)}</p>

<p><button class="btn btn-primary" onclick={auth}>Auth</button></p>
