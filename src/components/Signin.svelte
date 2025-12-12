<script lang="ts">
	import { authClient } from '../lib/auth-client'; //import the auth client
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let userError = $state('');
	let enableSigninButton = $derived((email === '') || (password === ''));
	let myModalElement: any; // Bind this to your modal's root element
	let bootstrapModal: any;

	// Svelte lifecycle hook to attach the event listener so we can see when dialog is closed
	// and clear down the variables.
	onMount( async () => {
		console.log('Component mounted');
        // Dynamically import Bootstrap's Modal class due to SSR by default
		const { Modal } = await import('bootstrap');
		bootstrapModal = Modal.getInstance(myModalElement) || new Modal(myModalElement as HTMLElement);

		if (myModalElement) {
			myModalElement.addEventListener('hidden.bs.modal', () => {
				console.log('Signin Modal is now hidden..Cleanup dialog variables!');
				handleModalReset();
			});
		}
	});

	function handleModalReset() {
		// Reset the dialog
		email = '';
		password = '';
		userError = ''
	}

	function handleDialogClose() {
		console.log('Dialog close requested');
		bootstrapModal.hide();

		// Manually remove the modal backdrop
		const modalBackdrop = document.querySelector('.modal-backdrop');
		modalBackdrop?.parentNode?.removeChild(modalBackdrop);
	}

	function handleRegister(event: Event) {
		event.preventDefault();
		handleDialogClose();
	}

	// Handle signin with the authClient
	async function handleSignin(event: Event) {
		userError = '';

		event.preventDefault();
		if (!email || !password) {
			userError = 'All fields are required.';
			return;
		}

		const { data, error } = await authClient.signIn.email({
        	email: email.toString() || "", // user email address
        	password: password.toString() || "", // user password -> min 8 characters by default
			rememberMe: false,
			callbackURL: "/auth/dashboard",
		}, {
			onRequest: (ctx) => {
				//show loading
		        console.log('onRequest call to authClient.signIn.email:');
			},
			onSuccess: async (ctx) => {
				//show success
				console.log('onSuccess call to authClient.signIn.email:');
				// Display a success message and then show button to signin
				handleModalReset();
				handleDialogClose();
			},
			onError: (ctx) => {
				//show error
				console.log('onError call to authClient.signIn.email:');
				// display the error message
				// return fail(400, { email, message: 'Invalid email address' });
				// reject({ status: 'error', message: ctx.error.message });

				alert(ctx.error.message);
			},
		});
	}
</script>

<div
	class="modal fade"
	id="signInModal"
	tabindex="-1"
	aria-labelledby="signInModalLabel"
	aria-hidden="true"
	bind:this={myModalElement}
>
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="signInModalLabel">Sign In</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<!-- Your sign-in form elements go hereL -->
				<form onsubmit={handleSignin}>
					<div class="mb-3">
						<label for="username" class="form-label">email</label>
						<input type="text" class="form-control" id="signin-email" bind:value={email} />
					</div>
					<div class="mb-3">
						<label for="passwordInput" class="form-label">Password</label>
						<input type="password" class="form-control" id="signin-passwordInput" bind:value={password} />
					</div>
					<button type="submit" class="btn btn-primary" disabled={enableSigninButton}>Sign in</button>
				</form>
			</div>
            <div class="modal-footer">
                <a href="#" class="btn btn-link" data-bs-toggle="modal" data-bs-target="#registerModal" onclick="{handleRegister}">Register</a>
                <a href="#" class="btn btn-link">Forgot password?</a>
            </div>
		</div>
	</div>
</div>
