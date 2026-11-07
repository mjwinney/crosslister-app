<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import { openAuthModal } from '$lib/auth-modal';
	import { appTheme, setAppTheme } from '$lib/stores/theme';
	import UserSettingsDialog from './UserSettingsDialog.svelte';

	const session = authClient.useSession();
	let settingsOpen = $state(false);

	async function handleLogout() {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => goto(resolve('/'))
			}
		});
	}

	function toggleTheme() {
		setAppTheme($appTheme === 'dark' ? 'light' : 'dark');
	}
</script>

<nav class="nav-shell relative z-10 border-b border-slate-700/30">
	<div class="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
		<a
			class="nav-brand text-base font-extrabold uppercase tracking-[0.08em] text-slate-50 transition-colors hover:text-cyan-300"
			href={resolve('/')}
			aria-label="PreListr home"
		>
			PreListr
		</a>

		<div class="flex items-center gap-3">
			<button
				type="button"
				class="theme-toggle inline-flex h-[50px] w-[100px] shrink-0 items-center justify-center rounded-full border border-slate-500/70 bg-slate-900/40 p-0 text-slate-200 transition hover:border-cyan-400 hover:text-white max-[420px]:w-[88px]"
				onclick={toggleTheme}
				aria-label="Toggle theme"
			>
				{$appTheme === 'dark' ? 'Light' : 'Dark'}
			</button>
			{#if !$session?.data}
				<button
					class="nav-cta inline-flex h-[50px] w-[136px] shrink-0 items-center justify-center rounded-full border border-transparent p-0 font-bold text-white transition-transform duration-200 hover:-translate-y-0.5 max-[420px]:w-[116px]"
					type="button"
					onclick={() => openAuthModal('signin')}
				>
					Sign In
				</button>
			{/if}
			{#if $session?.data}
				<div class="relative group">
					<button
						type="button"
						class="user-menu-btn inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border border-slate-500/70 bg-slate-900/40 p-0 text-slate-200 transition hover:border-cyan-400 hover:text-white"
						aria-label="User menu"
					>
						<svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" aria-hidden="true">
							<path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
						</svg>
					</button>
					<!-- Top padding keeps the panel reachable when the pointer moves down from the icon. -->
					<div
						class="invisible absolute right-0 top-full z-20 w-44 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
					>
						<div class="user-menu-panel rounded-xl border border-slate-600/60 bg-slate-900/95 p-1 shadow-xl">
							<button
								type="button"
								class="user-menu-item block w-full px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-slate-700/60 hover:text-cyan-300"
								onclick={(e) => {
									settingsOpen = true;
									e.currentTarget.blur();
								}}
							>
								User settings
							</button>
							<div
								role="menuitem"
								tabindex="0"
								class="user-menu-item block w-full px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-slate-700/60 hover:text-cyan-300 cursor-pointer"
								onclick={handleLogout}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleLogout();
									}
								}}
							>
								Log out
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<UserSettingsDialog bind:open={settingsOpen} timezone={page.data.userTimezone} />
</nav>

<style>
	.nav-shell {
		background: radial-gradient(circle at 10% -80%, rgba(124, 58, 237, 0.38), transparent 28rem),
			linear-gradient(105deg, #040b14, #0a1628 55%, #07111f);
		box-shadow: 0 8px 28px rgba(4, 11, 20, 0.25);
	}

	.nav-shell button {
		border-radius: 9999px;
	}

	.nav-shell .theme-toggle {
		font-size: 1rem;
		line-height: 1;
		letter-spacing: 0.08em;
		white-space: nowrap;
	}

	.nav-shell .nav-cta {
		font-size: 1.125rem;
		line-height: 1;
		white-space: nowrap;
	}

	:global(html[data-theme='light']) .nav-shell {
		background: radial-gradient(circle at 10% -80%, rgba(99, 102, 241, 0.12), transparent 24rem),
			linear-gradient(105deg, #f8fafc, #e2e8f0 55%, #dbeafe);
		box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
	}

	:global(html[data-theme='light']) .nav-brand,
	:global(html[data-theme='light']) .theme-toggle {
		color: #0f172a;
	}

	.nav-shell::after {
		position: absolute;
		inset: 0;
		background-image: linear-gradient(rgba(148, 163, 184, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px);
		background-size: 32px 32px;
		content: '';
		pointer-events: none;
	}

	.nav-brand:hover {
		color: #67e8f9;
	}

	.nav-cta {
		background: linear-gradient(135deg, #7c3aed, #22d3ee);
		box-shadow: 0 8px 24px rgba(124, 58, 237, 0.32);
	}

	:global(html[data-theme='light']) .nav-cta {
		box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2);
	}

	.nav-shell .user-menu-item {
		border-radius: 0.5rem;
	}

	:global(html[data-theme='light']) .user-menu-btn {
		background: #ffffff;
		color: #0f172a;
	}

	:global(html[data-theme='light']) .user-menu-panel {
		border-color: rgba(148, 163, 184, 0.6);
		background: #ffffff;
	}

	:global(html[data-theme='light']) .user-menu-item {
		color: #0f172a;
	}
</style>
