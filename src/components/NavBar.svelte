<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';

	const session = authClient.useSession();

	async function handleLogout() {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => goto(resolve('/'))
			}
		});
	}
</script>

<nav class="navbar navbar-expand-lg border-bottom">
	<div class="container-fluid">
		<a class="navbar-brand" href={resolve('/')}>PreListr</a>

		<div class="d-flex align-items-center">
			{#if $session?.data}
				<button class="btn nav-cta" type="button" onclick={handleLogout}>Log Out</button>
			{:else}
				<button
					class="btn nav-cta"
					type="button"
					data-bs-toggle="modal"
					data-bs-target="#signInModal"
				>
					Sign In
				</button>
			{/if}
		</div>
	</div>
</nav>

<style>
	:global(body) {
		background: #07111f;
		font-family: "Space Grotesk", "Trebuchet MS", sans-serif;
	}

	.navbar {
		position: relative;
		z-index: 10;
		padding: 0.75rem clamp(1rem, 2vw, 2rem);
		background: radial-gradient(circle at 10% -80%, rgba(124, 58, 237, 0.38), transparent 28rem), linear-gradient(105deg, #040b14, #0a1628 55%, #07111f);
		border-color: rgba(148, 163, 184, 0.18) !important;
		box-shadow: 0 8px 28px rgba(4, 11, 20, 0.25);
	}
	.navbar::after {
		position: absolute;
		inset: 0;
		background-image: linear-gradient(rgba(148, 163, 184, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px);
		background-size: 32px 32px;
		content: '';
		pointer-events: none;
	}
	.navbar > .container-fluid { position: relative; z-index: 1; }
	.navbar-brand { color: #f8fbff; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
	.navbar-brand:hover { color: #67e8f9; }
	.navbar .nav-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.85rem 1.4rem;
		border-radius: 999px;
		font-weight: 700;
		color: #fff;
		background: linear-gradient(135deg, #7c3aed, #22d3ee);
		border: 0;
		box-shadow: 0 8px 24px rgba(124, 58, 237, 0.32);
		transition: transform 180ms ease, box-shadow 180ms ease;
	}
	.navbar .nav-cta:hover { transform: translateY(-1px); }
</style>
