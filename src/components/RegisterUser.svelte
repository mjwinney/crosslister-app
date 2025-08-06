<script lang="ts">
    export let onRegister: (
        event: { username: string; password: string }
    ) => void;  // Callback function to handle registration

    let username = '';
    let password = '';
    let confirmPassword = '';
    let error = '';

    function handleRegister(event: Event) {
        event.preventDefault();
        if (!username || !password || !confirmPassword) {
            error = 'All fields are required.';
            return;
        }
        if (password !== confirmPassword) {
            error = 'Passwords do not match.';
            return;
        }
        error = '';
        // Call the callback function if provided
        if (typeof onRegister === 'function') {
            onRegister({ username, password });
        }
    }
</script>

<form class="container mt-4 p-4 bg-white rounded shadow-sm" on:submit|preventDefault={handleRegister}>
    <h2 class="mb-4">Register</h2>
    {#if error}
        <div class="alert alert-danger mb-2">{error}</div>
    {/if}
    <div class="mb-3">
        <label class="form-label" for="username">Username</label>
        <input
            id="username"
            type="text"
            class="form-control"
            bind:value={username}
            autocomplete="username"
        />
    </div>
    <div class="mb-3">
        <label class="form-label" for="password">Password</label>
        <input
            id="password"
            type="password"
            class="form-control"
            bind:value={password}
            autocomplete="new-password"
        />
    </div>
    <div class="mb-3">
        <label class="form-label" for="confirmPassword">Confirm Password</label>
        <input
            id="confirmPassword"
            type="password"
            class="form-control"
            bind:value={confirmPassword}
            autocomplete="new-password"
        />
    </div>
    <button type="submit" class="btn btn-success w-100">
        Register
    </button>
</form>