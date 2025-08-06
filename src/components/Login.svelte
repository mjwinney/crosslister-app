<script>
    let username = '';
    let password = '';
    let error = '';

    function handleLogin(event) {
        event.preventDefault();
        if (!username || !password) {
            error = 'Please enter both username and password.';
            return;
        }
        // Add your login logic here (e.g., call an API)
        error = '';
        // Example: console.log({ username, password });
    }
</script>

<form class="container mt-5 p-4 bg-white rounded shadow-sm" on:submit|preventDefault={handleLogin}>
    <h2 class="mb-4">Login</h2>
    {#if error}
        <div class="alert alert-danger mb-2">{error}</div>
    {/if}
    <div class="mb-3">
        <label class="form-label" for="username">Username</label>
        <input
            id="username"
            type="text"
            bind:value={username}
            class="form-control"
            autocomplete="username"
        />
    </div>
    <div class="mb-3">
        <label class="form-label" for="password">Password</label>
        <input
            id="password"
            type="password"
            bind:value={password}
            class="form-control"
            autocomplete="current-password"
        />
    </div>
    <button type="submit" class="btn btn-primary w-100">
        Login
    </button>
</form>
