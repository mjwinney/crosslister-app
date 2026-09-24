<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { authClient } from '$lib/auth-client';
	import { authModal, closeAuthModal, openAuthModal } from '$lib/auth-modal';

	const dispatch = createEventDispatcher<{ close: void; switch: 'signin' | 'register' }>();

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let displayName = $state('');
	let userError = $state('');
	let success = $state(false);
	let enableRegisterButton = $derived(
		email === '' || password === '' || confirmPassword === '' || displayName === ''
	);
	let isOpen = $derived($authModal === 'register');

	function handleModalReset() {
		email = '';
		password = '';
		confirmPassword = '';
		displayName = '';
		userError = '';
		success = false;
	}

	function handleClose() {
		handleModalReset();
		dispatch('close');
		closeAuthModal();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleBackdropKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}

	function handleOpenSignIn() {
		handleModalReset();
		dispatch('switch', 'signin');
		openAuthModal('signin');
	}

	async function handleRegister(event: Event) {
		userError = '';
		event.preventDefault();
		if (!email || !password || !confirmPassword || !displayName) {
			userError = 'All fields are required.';
			return;
		}
		if (password !== confirmPassword) {
			userError = 'Passwords do not match.';
			return;
		}

		const { error } = await authClient.signUp.email(
			{
				email: email.toString() || '',
				password: password.toString() || '',
				name: displayName.toString().trim() || 'User'
			},
			{
				onRequest: () => {
					console.log('onRequest call to authClient.signUp.email:');
				},
				onSuccess: () => {
					console.log('onSuccess call to authClient.signUp.email:');
					handleModalReset();
					success = true;
				},
				onError: (ctx) => {
					console.log('onError call to authClient.signUp.email:');
					alert(ctx.error.message);
				}
			}
		);

		if (error) {
			userError = error?.message ?? 'Registration failed. Please try again.';
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="registerModalLabel"
		tabindex="0"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
	>
		<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/90 shadow-2xl shadow-violet-900/20">
			<div class="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
				<h5 id="registerModalLabel" class="text-xl font-semibold text-slate-50">Register</h5>
				<button
					type="button"
					class="rounded-full border border-slate-600/80 px-2 py-1 text-lg text-slate-300 transition hover:border-slate-400 hover:text-white"
					aria-label="Close"
					onclick={handleClose}
				>
					×
				</button>
			</div>

			<div class="space-y-4 p-5">
				<form class="space-y-4" onsubmit={handleRegister}>
					{#if userError}
						<div class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
							{userError}
						</div>
					{/if}
					{#if success}
						<div class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
							Registration successful! You can now sign in.
							<button type="button" class="ml-2 font-semibold text-cyan-300 underline" onclick={handleOpenSignIn}>
								Sign In
							</button>
						</div>
					{/if}

					<div>
						<label for="register-email" class="mb-2 block text-sm font-medium text-slate-200">Email</label>
						<input
							type="email"
							id="register-email"
							class="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-slate-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
							bind:value={email}
							autocomplete="email"
						/>
					</div>

					<div>
						<label for="register-passwordInput" class="mb-2 block text-sm font-medium text-slate-200">Password</label>
						<input
							type="password"
							id="register-passwordInput"
							class="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-slate-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
							bind:value={password}
							autocomplete="new-password"
						/>
					</div>

					<div>
						<label for="register-confirmPasswordInput" class="mb-2 block text-sm font-medium text-slate-200">Confirm Password</label>
						<input
							type="password"
							id="register-confirmPasswordInput"
							class="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-slate-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
							bind:value={confirmPassword}
							autocomplete="new-password"
						/>
					</div>

					<div>
						<label for="register-displayNameInput" class="mb-2 block text-sm font-medium text-slate-200">Display name</label>
						<input
							type="text"
							id="register-displayNameInput"
							class="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-slate-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
							bind:value={displayName}
							autocomplete="name"
						/>
					</div>

					<button
						type="submit"
						class="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={enableRegisterButton}
					>
						Register
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}
