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

</script>

<h1>Dashboard</h1>
