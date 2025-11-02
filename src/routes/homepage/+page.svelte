<script lang="ts">
	import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";

    onMount( async () => {
        const session = await authClient.getSession();
        // console.log(`Homepage page load function: session=${JSON.stringify(session)}`);
        if (!session || !session?.data) {
            goto('/homepage');
        }
	});

</script>

<h1>Homepage</h1>
<p>Welcome to the homepage!</p>