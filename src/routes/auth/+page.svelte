<!-- src/routes/your-page/+page.svelte -->
<script lang="ts">
    // import Register from '../../components/Register.svelte';

    import type { ActionData } from './$types';
    export let form: ActionData;
</script>

<!-- <Register /> -->


<h1>Submit Data</h1>

<form method="POST">
    <input type="text" name="username" placeholder="Username">
    <button type="submit">Submit Default</button>
</form>

<form method="POST" action="?/anotherAction">
    <input type="text" name="item" placeholder="Item">
    <button type="submit">Submit Another Action</button>
</form>

{#if form?.success}
    <p>Action successful!</p>
{/if}
