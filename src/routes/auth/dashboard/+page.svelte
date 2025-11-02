<script lang="ts">
	import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";
	// import NavSideBar from "../../components/NavSideBar.svelte";

    onMount( async () => {
        const session = await authClient.getSession();
        // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
        if (!session || !session?.data) {
            goto('/homepage');
        }
	});

</script>

<h1>Dashboard</h1>
<!-- <NavSideBar children={children} /> -->