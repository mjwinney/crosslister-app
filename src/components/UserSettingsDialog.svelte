<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TIMEZONES } from '$lib/timezones';

	let {
		open = $bindable(false),
		timezone
	}: { open: boolean; timezone: string } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let selected = $state('');
	let saving = $state(false);
	let error = $state('');

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			selected = timezone;
			error = '';
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	async function save() {
		saving = true;
		error = '';
		try {
			const res = await fetch('/api/user-settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timezone: selected })
			});
			if (!res.ok) throw new Error('Save failed');
			open = false;
			void invalidateAll();
		} catch {
			error = 'Could not save settings. Try again.';
		} finally {
			saving = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="settings-dialog"
	aria-labelledby="user-settings-title"
	onclose={() => (open = false)}
>
	<div class="panel">
		<h2 id="user-settings-title">User settings</h2>

		<label class="field">
			<span>Timezone</span>
			<select bind:value={selected}>
				{#each TIMEZONES as tz (tz)}
					<option value={tz}>{tz}</option>
				{/each}
			</select>
		</label>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<div class="actions">
			<button type="button" class="btn-secondary" onclick={() => (open = false)}>Cancel</button>
			<button type="button" class="btn-primary" onclick={save} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</button>
		</div>
	</div>
</dialog>

<style>
	.settings-dialog {
		position: fixed;
		inset: 0;
		margin: auto;
		height: fit-content;
		width: min(26rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		padding: 0;
		border: none;
		border-radius: 1rem;
		background: transparent;
		color: #e2e8f0;
	}

	.settings-dialog::backdrop {
		background: rgba(4, 11, 20, 0.7);
		backdrop-filter: blur(4px);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 1rem;
		background: radial-gradient(circle at 10% -80%, rgba(124, 58, 237, 0.3), transparent 20rem),
			linear-gradient(105deg, #040b14, #0a1628 55%, #07111f);
		box-shadow: 0 16px 40px rgba(4, 11, 20, 0.45);
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: #f8fafc;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.9rem;
		font-weight: 600;
	}

	select {
		padding: 0.6rem 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.5);
		border-radius: 0.6rem;
		background: rgba(15, 23, 42, 0.6);
		color: #e2e8f0;
	}

	select:focus-visible {
		outline: 2px solid #22d3ee;
		outline-offset: 2px;
	}

	.error {
		margin: 0;
		font-size: 0.9rem;
		color: #f87171;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
	}

	button {
		padding: 0.6rem 1.1rem;
		border-radius: 9999px;
		font-weight: 700;
		font-size: 0.95rem;
		transition:
			transform 200ms,
			border-color 200ms,
			color 200ms;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		border: 1px solid rgba(148, 163, 184, 0.7);
		background: rgba(15, 23, 42, 0.4);
		color: #e2e8f0;
	}

	.btn-secondary:hover {
		border-color: #22d3ee;
		color: #fff;
	}

	.btn-primary {
		border: none;
		background: linear-gradient(135deg, #7c3aed, #22d3ee);
		box-shadow: 0 8px 24px rgba(124, 58, 237, 0.32);
		color: #fff;
	}

	.btn-primary:not(:disabled):hover {
		transform: translateY(-2px);
	}

	:global(html[data-theme='light']) .settings-dialog {
		color: #0f172a;
	}

	:global(html[data-theme='light']) .panel {
		border-color: rgba(148, 163, 184, 0.5);
		background: radial-gradient(circle at 10% -80%, rgba(99, 102, 241, 0.12), transparent 18rem),
			linear-gradient(105deg, #f8fafc, #e2e8f0 55%, #dbeafe);
		box-shadow: 0 16px 40px rgba(15, 23, 42, 0.15);
	}

	:global(html[data-theme='light']) h2 {
		color: #0f172a;
	}

	:global(html[data-theme='light']) select {
		border-color: rgba(100, 116, 139, 0.6);
		background: #ffffff;
		color: #0f172a;
	}

	:global(html[data-theme='light']) .error {
		color: #b91c1c;
	}

	:global(html[data-theme='light']) .btn-secondary {
		border-color: rgba(100, 116, 139, 0.6);
		background: #ffffff;
		color: #0f172a;
	}

	:global(html[data-theme='light']) .btn-secondary:hover {
		border-color: #3b82f6;
		color: #0f172a;
	}

	:global(html[data-theme='light']) .btn-primary {
		box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2);
	}
</style>
