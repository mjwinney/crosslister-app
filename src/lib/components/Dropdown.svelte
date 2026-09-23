<script lang="ts">
	let {
		trigger = '⋯',
		children,
	}: {
		trigger?: string;
		children?: import('svelte').Snippet;
	} = $props();

	let isOpen = $state(false);
	let dropdownRef = $state<HTMLElement | null>(null);
	let triggerRef = $state<HTMLElement | null>(null);
	let menuStyle = $state('');
	let submenuSide = $state<'right' | 'left'>('right');

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		isOpen = !isOpen;
		if (isOpen && triggerRef) {
			const rect = triggerRef.getBoundingClientRect();
			const spaceRight = window.innerWidth - rect.right;
			const spaceLeft = rect.left;
			const spaceBelow = window.innerHeight - rect.bottom;
			const spaceAbove = rect.top;
			const submenuWidth = 160;
			const menuHeight = 200; // approximate height of the dropdown menu

			// Determine horizontal position (left or right)
			let horizontalStyle = '';
			if (spaceRight >= submenuWidth || spaceRight >= spaceLeft) {
				horizontalStyle = `left: ${rect.right - 12}px; right: auto;`;
				submenuSide = 'right';
			} else {
				horizontalStyle = `left: auto; right: ${window.innerWidth - rect.left - 12}px;`;
				submenuSide = 'left';
			}

			// Determine vertical position (below or above)
			let verticalStyle = '';
			if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
				// Align with the trigger
				verticalStyle = `top: ${rect.top}px; bottom: auto;`;
			} else {
				// Position above
				verticalStyle = `top: auto; bottom: ${window.innerHeight - rect.top}px;`;
			}

			menuStyle = `position: fixed; ${horizontalStyle} ${verticalStyle}`;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (dropdownRef) {
			const isInsideDropdown = dropdownRef.contains(e.target as Node);

			if (!isInsideDropdown) {
				isOpen = false;
			}
		}
	}

	function handleCrosslistComplete() {
		isOpen = false;
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside, true);
			document.addEventListener('crosslist-complete', handleCrosslistComplete);
		} else {
			document.removeEventListener('click', handleClickOutside, true);
			document.removeEventListener('crosslist-complete', handleCrosslistComplete);
		}
		return () => {
			document.removeEventListener('click', handleClickOutside, true);
			document.removeEventListener('crosslist-complete', handleCrosslistComplete);
		};
	});
</script>

<div class="dropdown" bind:this={dropdownRef}>
	<button class="btn btn-link p-0 text-dark dropdown-trigger" type="button" onclick={toggle} bind:this={triggerRef} title="Actions">
		{trigger}
	</button>
	{#if isOpen}
		<div class="dropdown-menu dropdown-menu-end show {submenuSide === 'right' ? 'caret-right' : 'caret-left'}" style={menuStyle}>
			{@render children?.()}
		</div>
	{/if}
</div>

<style>
	.dropdown {
		position: relative;
		display: inline-block;
		overflow: visible;
	}

	.dropdown-trigger {
		font-size: 1.25rem;
		line-height: 1;
		padding: 0.25rem;
		color: #333;
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: none;
	}

	.dropdown-trigger:hover {
		color: #000;
		text-decoration: none;
	}

	:global(.dropdown-menu) {
		font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
		min-width: unset !important;
		max-width: unset !important;
		padding: 0.5rem 0;
		margin: 0;
		background-color: var(--bs-body-bg, #fff);
		background-clip: padding-box;
		border: 1px solid var(--bs-border-color, rgba(0, 0, 0, 0.15));
		border-radius: 0.25rem;
		box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);
		z-index: 1000;
		overflow: visible;
	}

	:global(.dropdown-menu li) {
		list-style: none;
	}

	:global(.dropdown-menu > li) {
		position: relative;
	}

	:global(.dropdown-menu .dropdown-item) {
		display: block;
		width: 100%;
		padding: 0.5rem 1rem;
		clear: both;
		color: var(--bs-body-color, #212529);
		text-decoration: none;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 1rem;
	}

	:global(.dropdown-menu .dropdown-item:hover) {
		background-color: var(--bs-secondary-bg, #f8f9fa);
		color: var(--bs-emphasis-color, #16181b);
	}

	:global(.dropdown-menu .submenu-trigger) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		background-color: transparent !important;
	}

	:global(.dropdown-menu .submenu-trigger::before) {
		content: '›';
		margin-right: 0.75rem;
		color: currentColor;
		font-size: 1.25rem;
		line-height: 0.75;
		flex-shrink: 0;
	}

	:global(.dropdown-menu.caret-left .submenu-trigger::before) {
		content: '‹';
	}

	:global(.dropdown-menu .submenu-content) {
		display: none;
		position: absolute;
		top: -0.5rem;
		left: calc(100% + 4px);
		right: auto;
		min-width: 140px !important;
		width: max-content;
		padding: 0.5rem 0;
		background-color: var(--bs-body-bg, #fff);
		background-clip: padding-box;
		border: 1px solid var(--bs-border-color, rgba(0, 0, 0, 0.15));
		border-radius: 0.25rem;
		box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);
		z-index: 1001;
	}

	:global(.dropdown-menu > li:hover > .submenu-content),
	:global(.dropdown-menu > li:focus-within > .submenu-content) {
		display: block;
	}

	:global(.dropdown-menu.caret-left .submenu-content) {
		left: auto;
		right: calc(100% + 4px);
	}
</style>