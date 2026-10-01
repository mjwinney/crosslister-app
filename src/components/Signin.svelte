<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createEventDispatcher } from 'svelte';
	import { authClient } from '$lib/auth-client';
	import { authModal, closeAuthModal, openAuthModal } from '$lib/auth-modal';

	const dispatch = createEventDispatcher<{ close: void; switch: 'signin' | 'register'; loading: boolean }>();

	let email = $state('');
	let password = $state('');
	let userError = $state('');
	let enableSigninButton = $derived(email === '' || password === '');
	let isOpen = $derived($authModal === 'signin');

	function handleModalReset() {
		email = '';
		password = '';
		userError = '';
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

	function handleOpenRegister() {
		handleModalReset();
		dispatch('switch', 'register');
		openAuthModal('register');
	}

	async function handleSignin(event: Event) {
		userError = '';
		event.preventDefault();
		if (!email || !password) {
			userError = 'All fields are required.';
			return;
		}

		try {
			const { error } = await authClient.signIn.email(
				{
					email: email.toString() || '',
					password: password.toString() || '',
					rememberMe: false
				},
				{
					onRequest: () => {
						dispatch('loading', true);
					},
					onSuccess: async () => {
						handleClose();
						try {
							await goto(resolve('/auth/dashboard'));
						} finally {
							dispatch('loading', false);
						}
					},
					onError: (ctx) => {
						dispatch('loading', false);
						userError = ctx.error.message;
					}
				}
			);

			if (error) {
				dispatch('loading', false);
				userError = error.message ?? 'Sign in failed. Please try again.';
			}
		} catch (error) {
			dispatch('loading', false);
			userError = error instanceof Error ? error.message : 'Sign in failed. Please try again.';
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="signInModalLabel"
		tabindex="0"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
	>
		<div class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/90 shadow-2xl shadow-violet-900/20">
			<div class="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
				<h5 id="signInModalLabel" class="text-xl font-semibold text-slate-50">Sign In</h5>
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
				<form class="space-y-4" onsubmit={handleSignin}>
					{#if userError}
						<div class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
							{userError}
						</div>
					{/if}

					<div>
						<label for="signin-email" class="mb-2 block text-sm font-medium text-slate-200">Email</label>
						<input
							type="email"
							id="signin-email"
							class="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-slate-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
							bind:value={email}
							autocomplete="email"
						/>
					</div>

					<div>
						<label for="signin-passwordInput" class="mb-2 block text-sm font-medium text-slate-200">Password</label>
						<input
							type="password"
							id="signin-passwordInput"
							class="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-slate-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
							bind:value={password}
							autocomplete="current-password"
						/>
					</div>

					<button
						type="submit"
						class="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={enableSigninButton}
					>
						Sign in
					</button>
				</form>
			</div>

			<div class="flex items-center justify-between border-t border-slate-700/60 bg-slate-950/30 px-5 py-4 text-sm">
				<button type="button" class="font-medium text-cyan-300 transition hover:text-cyan-200" onclick={handleOpenRegister}>
					Register
				</button>
				<button type="button" class="font-medium text-slate-400 transition hover:text-slate-200">
					Forgot password?
				</button>
			</div>
		</div>
	</div>
{/if}
