<script lang="ts">

	let username = '';
	let password = '';
	let confirmPassword = '';
	let error = '';
	let success = '';
	let submitting = false;

	async function handleRegister(event: Event) {
		success = "";

		event.preventDefault();
		if (!username || !password || !confirmPassword) {
			error = 'All fields are required.';
			return;
		}
		if (password !== confirmPassword) {
			error = 'Passwords do not match.';
			return;
		}

		submitting = true;

		console.log('Registering user:', username, password);
		// Send message to server
		const response = await fetch('/api/register', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ username, password })
		});

		// Handle response
		if (!response.ok) {
			const errorData = await response.json();
			console.log(`Registration failed: error=${errorData.message} code=${errorData.code}`);
			error = errorData.message;
			submitting = false;
			return;
		} else {
			const successData = await response.json();
			console.log(`Registration successful: error=${successData.message} code=${successData.code}`);
			success = 'Registration complete.  You can now sign in';
			submitting = true;
            // Perhaps instead of closing we should tell user was successful and
            // allow them to log in
			// Now must close the dialog
			// const modalElement = document.getElementById('registerModal');
			// const modal =
			// 	bootstrap.Modal.getInstance(modalElement as HTMLElement) ||
			// 	new bootstrap.Modal(modalElement as HTMLElement);
			// modal.hide(); // Hide the modal
		}

		error = '';
	}
</script>

<div
	class="modal fade"
	id="registerModal"
	tabindex="-1"
	aria-labelledby="registerModalLabel"
	aria-hidden="true"
>
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="registerModalLabel">Register</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<!-- Your sign-in form elements go here -->
				<form on:submit|preventDefault={handleRegister}>
					{#if error}
						<div class="alert alert-danger mb-2">{error}</div>
					{/if}
					<div class="mb-3">
						<label for="username" class="form-label">Username</label>
						<input type="text" class="form-control" id="register-username" bind:value={username} />
					</div>
					<div class="mb-3">
						<label for="passwordInput" class="form-label">Password</label>
						<input
							type="password"
							class="form-control"
							id="register-passwordInput"
							bind:value={password}
						/>
					</div>
					<div class="mb-3">
						<label for="passwordInput" class="form-label">Confirm Password</label>
						<input
							type="password"
							class="form-control"
							id="register-confirmPasswordInput"
							bind:value={confirmPassword}
						/>
					</div>
					<button type="submit" class="btn btn-primary" disabled={submitting}>Register</button>
				</form>
			</div>
			<div class="modal-footer d-flex justify-content-center">
				{#if success}
						<div class="text-success">{success}
							<a href="#" class="btn btn-link" data-bs-toggle="modal" data-bs-target="#signInModal">Sign In</a>
						</div>
				{/if}
            </div>
		</div>
	</div>
</div>

<!-- <script lang="ts">
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
</form> -->
