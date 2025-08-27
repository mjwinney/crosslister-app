<script lang="ts">
	import { authClient } from '../lib/auth-client'; //import the auth client
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let displayName = $state('');
	let userError = $state('');
	let success = $state(false);
	let enableRegisterButton = $derived((email === '') || (password === '') || (confirmPassword === '') || (displayName === ''));
	let myModalElement: HTMLDivElement; // Bind this to your modal's root element
	
	// Svelte lifecycle hook to attach the event listener so we can see when dialog is closed
	// and clear down the variables.
	onMount(() => {
		console.log('Component mounted');
		if (myModalElement) {
			myModalElement.addEventListener('hidden.bs.modal', () => {
				console.log('Register Modal is now hidden..Cleanup dialog variables!');
				handleModalReset();
			});
		}
	});

	function handleModalReset() {
		// Reset the dialog
		email = '';
		password = '';
		confirmPassword = '';
		userError = ''
		displayName = '';
	}

	// Handle registration with the authClient
	async function handleRegister(event: Event) {
		userError = '';

		event.preventDefault();
		if (!email || !password || !confirmPassword) {
			userError = 'All fields are required.';
			return;
		}
		if (password !== confirmPassword) {
			userError = 'Passwords do not match.';
			return;
		}

		// submitting = true;

		const { data, error } = await authClient.signUp.email({
        	email: email.toString() || "", // user email address
        	password: password.toString() || "", // user password -> min 8 characters by default
			name: "MarksName"
	        // name: name.toString() || "", // user display name
	        // image, // User image URL (optional)
	        // callbackURL: "/dashboard" // A URL to redirect to after the user verifies their email (optional)
	    }, {
			onRequest: (ctx) => {
				//show loading
		        console.log('onRequest call to authClient.signUp.email:');
			},
			onSuccess: (ctx) => {
				// Display a success message and then show button to signin
				handleModalReset();
				success = true;
			},
			onError: (ctx) => {
				//show error
				console.log('onError call to authClient.signUp.email:');
				// display the error message
				// return fail(400, { email, message: 'Invalid email address' });
				// reject({ status: 'error', message: ctx.error.message });

				alert(ctx.error.message);
			},
		});



		// const formData = new FormData();
		// formData.append('email', email);
		// formData.append('password', password);

		// // Send request to the auth/+page.server.ts
		// const response = await fetch('/auth?/anotherAction', {
		// 	method: 'POST',
		// 	body: formData
		// });

		// Handle response
		// if (!response.ok) {
		// 	const errorData = await response.json();
		// 	console.log(`Registration failed: error=${errorData.message} code=${errorData.code}`);
		// 	error = errorData.message;
		// 	submitting = false;
		// 	return;
		// } else {
		// 	const successData = await response.json();
		// 	console.log(`Registration successful: error=${successData.message} code=${successData.code}`);
		// 	success = 'Registration complete.  You can now sign in';
		// 	submitting = true;
        //     // Perhaps instead of closing we should tell user was successful and
        //     // allow them to log in
		// 	// Now must close the dialog
		// 	// const modalElement = document.getElementById('registerModal');
		// 	// const modal =
		// 	// 	bootstrap.Modal.getInstance(modalElement as HTMLElement) ||
		// 	// 	new bootstrap.Modal(modalElement as HTMLElement);
		// 	// modal.hide(); // Hide the modal
		// }

		userError = '';
	}
</script>

<div
	class="modal fade"
	id="registerModal"
	tabindex="-1"
	aria-labelledby="registerModalLabel"
	aria-hidden="true"
	bind:this={myModalElement}
>
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="registerModalLabel">Register</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<!-- Your sign-in form elements go here -->
				<form onsubmit={handleRegister}>
					{#if userError}
						<div class="alert alert-danger mb-2">{userError}</div>
					{/if}
					{#if success}
						<div class="alert alert-success mb-2">Registration successful! You can now sign in.
							<button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#signInModal">
								Sign In
							</button>
						</div>
					{/if}
					<div class="mb-3">
						<label for="email" class="form-label">Email</label>
						<input type="email" class="form-control" id="register-email" bind:value={email} />
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
					<div class="mb-3">
						<label for="displayNameInput" class="form-label">Display name</label>
						<input
							type="text"
							class="form-control"
							id="register-displayNameInput"
							bind:value={displayName}
						/>
					</div>
					<button type="submit" class="btn btn-primary" disabled={enableRegisterButton}>Register</button>
				</form>
			</div>
			<!-- <div class="modal-footer d-flex justify-content-center">
				{#if success}
						<div class="text-success">{success}
							<a href="#" class="btn btn-link" data-bs-toggle="modal" data-bs-target="#signInModal">Sign In</a>
						</div>
				{/if}
            </div> -->
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
