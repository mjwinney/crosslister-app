<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import { openAuthModal } from '$lib/auth-modal';
	import { appTheme, setAppTheme } from '$lib/stores/theme';

	const session = authClient.useSession();

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
			{#if $session?.data}
				<button
					class="nav-cta nav-logout inline-flex shrink-0 items-center justify-center rounded-full border-0 font-bold text-white transition-transform duration-200 hover:-translate-y-0.5"
					type="button"
					onclick={handleLogout}
				>
					Log Out
				</button>
			{:else}
				<button
					class="nav-cta inline-flex h-[50px] w-[136px] shrink-0 items-center justify-center rounded-full border border-transparent p-0 font-bold text-white transition-transform duration-200 hover:-translate-y-0.5 max-[420px]:w-[116px]"
					type="button"
					onclick={() => openAuthModal('signin')}
				>
					Sign In
				</button>
			{/if}
		</div>
	</div>
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

	.nav-shell .nav-logout {
		padding: 13.6px 22.4px;
		font-size: 1rem;
		line-height: 1.5;
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
</style>
