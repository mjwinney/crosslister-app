<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';

	type DatepickerEvent = Event & { detail?: { datepicker?: { element?: { value?: string } } } };

	// client only references
	let inputEl: HTMLInputElement | null = null;
	let dp: any = null;
	const dispatch = createEventDispatcher<{ blur: FocusEvent; focusout: FocusEvent }>();

	let { selectedDate = $bindable() } = $props();

	function onChangeDate(ev: DatepickerEvent) {
		selectedDate = ev.detail?.datepicker?.element?.value ?? inputEl?.value ?? selectedDate;
	}

	function openDatePicker() {
		inputEl?.focus();
		dp?.show?.();
	}

	onMount(async () => {
		if (typeof window === 'undefined' || !inputEl) return;

		const mod = await import('vanillajs-datepicker');
		const Datepicker = (mod as any).Datepicker ?? (mod as any).default ?? mod;

		dp = new Datepicker(inputEl, {
			buttonClass: 'datepicker-button',
			allowOneSidedRange: true,
			format: 'mm/dd/yyyy',
			autohide: true,
			container: document.body
		});

		inputEl.addEventListener('changeDate', onChangeDate as EventListener);
	});

	onDestroy(() => {
		if (inputEl) inputEl.removeEventListener('changeDate', onChangeDate as EventListener);
		dp?.destroy?.();
	});
</script>

<style>
		.datepicker-input {
			box-sizing: border-box;
			width: 100%;
			border: 1px solid var(--auth-border, var(--panel-border, #94a3b8));
			border-radius: 0.375rem;
			padding: 0.5rem 2.75rem 0.5rem 0.75rem;
			background-color: var(--auth-input-bg, var(--panel-bg, #0f172a));
			color: var(--auth-text, var(--text, #edf6ff));
			font: inherit;
			line-height: 1.5;
			box-shadow: none;
		}

		.datepicker-field {
			position: relative;
		}

		.datepicker-trigger {
			position: absolute;
			top: 50%;
			right: 0.25rem;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2.25rem;
			height: 2.25rem;
			transform: translateY(-50%);
			border: 1px solid transparent;
			border-radius: 0.375rem;
			padding: 0;
			background: transparent;
			color: var(--auth-muted, var(--muted, #94a3b8));
			cursor: pointer;
			z-index: 1;
		}

		.datepicker-trigger:hover,
		.datepicker-trigger:focus-visible {
			border-color: var(--auth-border, var(--panel-border, #94a3b8));
			background: var(--auth-surface-hover, rgba(30, 48, 76, 0.96));
			color: var(--auth-text, var(--text, #edf6ff));
			outline: none;
		}

		.datepicker-trigger:focus-visible {
			box-shadow: 0 0 0 2px var(--auth-accent, var(--primary, #7c3aed));
		}

		.datepicker-trigger svg {
			width: 1.125rem;
			height: 1.125rem;
		}

		.datepicker-input::placeholder {
			color: var(--auth-muted, var(--muted, #94a3b8));
		}

		.datepicker-input:focus {
			border-color: var(--auth-accent, var(--primary, #7c3aed));
			outline: 0;
			box-shadow: 0 0 0 3px
				color-mix(in srgb, var(--auth-accent, var(--primary, #7c3aed)) 22%, transparent);
		}

		:global(.datepicker) {
			display: none;
			color: var(--auth-text, var(--text, #edf6ff));
			font-size: 0.875rem;
		}

		:global(.datepicker.active) {
			display: block;
		}

		:global(.datepicker-dropdown) {
			position: absolute;
			z-index: 2000;
			top: 0;
			left: 0;
			padding-top: 0.25rem;
		}

		:global(.datepicker-dropdown.datepicker-orient-top) {
			padding-top: 0;
			padding-bottom: 0.25rem;
		}

		:global(.datepicker-picker) {
			display: inline-block;
			border: 1px solid var(--auth-border, var(--panel-border, #94a3b8));
			border-radius: 0.5rem;
			padding: 0.25rem;
			background: var(--auth-surface-raised, var(--panel-strong, #12233b));
			box-shadow: 0 0.75rem 1.75rem rgba(0, 0, 0, 0.24);
		}

		:global(.datepicker-picker span) {
			display: block;
			flex: 1;
			border: 0;
			border-radius: 0.375rem;
			text-align: center;
			user-select: none;
		}

		:global(.datepicker-controls),
		:global(.datepicker-grid),
		:global(.datepicker-view),
		:global(.datepicker-view .days-of-week) {
			display: flex;
		}

		:global(.datepicker-controls) {
			align-items: center;
			gap: 0.25rem;
		}

		:global(.datepicker-controls .datepicker-button) {
			min-height: 2.25rem;
			border: 1px solid transparent;
			border-radius: 0.375rem;
			padding: 0.375rem 0.625rem;
			background: transparent;
			color: var(--auth-text, var(--text, #edf6ff));
			font: inherit;
			cursor: pointer;
		}

		:global(.datepicker-controls .datepicker-button:hover:not(:disabled)),
		:global(.datepicker-controls .datepicker-button:focus-visible) {
			border-color: var(--auth-border, var(--panel-border, #94a3b8));
			background: var(--auth-surface-hover, rgba(30, 48, 76, 0.96));
			outline: none;
		}

		:global(.datepicker-controls .datepicker-button:focus-visible) {
			box-shadow: 0 0 0 2px var(--auth-accent, var(--primary, #7c3aed));
		}

		:global(.datepicker-controls .datepicker-button:disabled) {
			color: var(--auth-muted, var(--muted, #94a3b8));
			cursor: default;
			opacity: 0.6;
		}

		:global(.datepicker-controls .view-switch) {
			flex: auto;
			font-weight: 600;
		}

		:global(.datepicker-controls .next-btn),
		:global(.datepicker-controls .prev-btn) {
			width: 2.25rem;
			padding-right: 0.375rem;
			padding-left: 0.375rem;
		}

		:global(.datepicker-controls .next-btn.disabled),
		:global(.datepicker-controls .prev-btn.disabled) {
			visibility: hidden;
		}

		:global(.datepicker-header .datepicker-controls) {
			padding: 0.125rem 0.125rem 0;
		}

		:global(.datepicker-title) {
			padding: 0.375rem 0.75rem;
			border-bottom: 1px solid var(--auth-border, var(--panel-border, #94a3b8));
			text-align: center;
			font-weight: 700;
		}

		:global(.datepicker-main) {
			padding: 0.125rem;
		}

		:global(.datepicker-grid) {
			width: 15.75rem;
			flex-wrap: wrap;
		}

		:global(.datepicker-view .days .datepicker-cell),
		:global(.datepicker-view .dow) {
			flex-basis: 14.2857142857%;
		}

		:global(.datepicker-view.datepicker-grid .datepicker-cell) {
			flex-basis: 25%;
			height: 4.5rem;
			line-height: 4.5rem;
		}

		:global(.datepicker-cell),
		:global(.datepicker-view .week) {
			height: 2.25rem;
			line-height: 2.25rem;
		}

		:global(.datepicker-view .dow) {
			height: 1.5rem;
			color: var(--auth-muted, var(--muted, #94a3b8));
			font-size: 0.75rem;
			font-weight: 600;
			line-height: 1.5rem;
		}

		:global(.datepicker-view .week) {
			width: 2.25rem;
			color: var(--auth-muted, var(--muted, #94a3b8));
			font-size: 0.75rem;
		}

		:global(.datepicker-cell:not(.disabled):hover) {
			background: var(--auth-surface-hover, rgba(30, 48, 76, 0.96));
			cursor: pointer;
		}

		:global(.datepicker-cell.focused:not(.selected)) {
			background: var(--auth-surface-hover, rgba(30, 48, 76, 0.96));
		}

		:global(.datepicker-cell.selected),
		:global(.datepicker-cell.selected:hover) {
			background: var(--auth-accent, var(--primary, #7c3aed));
			color: #fff;
			font-weight: 600;
		}

		:global(.datepicker-cell.disabled) {
			color: var(--auth-muted, var(--muted, #94a3b8));
			opacity: 0.55;
		}

		:global(.datepicker-cell.next:not(.disabled)),
		:global(.datepicker-cell.prev:not(.disabled)) {
			color: var(--auth-muted, var(--muted, #94a3b8));
		}

		:global(.datepicker-cell.today:not(.selected)) {
			box-shadow: inset 0 0 0 1px var(--auth-accent-2, var(--primary-2, #22d3ee));
		}

		:global(.datepicker-cell.range-end:not(.selected)),
		:global(.datepicker-cell.range-start:not(.selected)) {
			background: var(--auth-accent, var(--primary, #7c3aed));
			color: #fff;
		}

		:global(.datepicker-cell.range-start) {
			border-radius: 0.375rem 0 0 0.375rem;
		}

		:global(.datepicker-cell.range-end) {
			border-radius: 0 0.375rem 0.375rem 0;
		}

		:global(.datepicker-cell.range) {
			border-radius: 0;
			background: color-mix(in srgb, var(--auth-accent, var(--primary, #7c3aed)) 20%, transparent);
		}

		:global(.datepicker-footer) {
			border-top: 1px solid var(--auth-border, var(--panel-border, #94a3b8));
		}

		:global(.datepicker-footer .datepicker-controls .datepicker-button) {
			width: 100%;
			margin: 0.25rem;
			font-size: 0.8125rem;
		}

		@media (max-width: 22.5rem) {
			:global(.datepicker-grid) {
				width: 13.78125rem;
			}

			:global(.datepicker-view .week) {
				width: 1.96875rem;
			}
		}
</style>

<div class="datepicker-field">
	<input
		class="datepicker-input"
		bind:this={inputEl}
		type="text"
		name="foo"
		autocomplete="off"
		autocorrect="off"
		autocapitalize="off"
		spellcheck="false"
		aria-autocomplete="none"
		bind:value={selectedDate}
		onblur={(e) => dispatch('blur', e)}
		onfocusout={(e) => dispatch('focusout', e)}
	/>
	<button
		class="datepicker-trigger"
		type="button"
		aria-label="Open date picker"
		title="Open date picker"
		onmousedown={(event) => event.preventDefault()}
		onclick={openDatePicker}
	>
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<rect x="3" y="4.5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.75" />
			<path
				d="M16 2.5v4M8 2.5v4M3 9.5h18"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
			/>
		</svg>
	</button>
</div>
