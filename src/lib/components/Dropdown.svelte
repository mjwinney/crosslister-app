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
			const submenuWidth = 160;

			if (spaceRight >= submenuWidth || spaceRight >= spaceLeft) {
				menuStyle = `position: fixed; left: ${rect.right}px; right: auto; top: ${rect.bottom}px;`;
				submenuSide = 'right';
			} else {
				menuStyle = `position: fixed; left: auto; right: ${spaceRight}px; top: ${rect.bottom}px;`;
				submenuSide = 'left';
			}
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (dropdownRef) {
			// Check if click is inside dropdown or any submenu
			const isInsideDropdown = dropdownRef.contains(e.target as Node);
			const isInsideSubmenu = (e.target as Node).closest?.('.submenu-content');

			if (!isInsideDropdown && !isInsideSubmenu) {
				isOpen = false;
			}
		}
	}

	function handleSubmenuPosition(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const submenu = target.nextElementSibling as HTMLElement | null;
		const dropdownMenu = dropdownRef?.querySelector('.dropdown-menu') as HTMLElement | null;
		if (submenu && submenu.classList.contains('submenu-content') && dropdownMenu) {
			const menuRect = dropdownMenu.getBoundingClientRect();
			const submenuWidth = 140;
			const spaceRight = window.innerWidth - menuRect.right;
			const spaceLeft = menuRect.left;

			if (spaceRight >= submenuWidth || spaceRight >= spaceLeft) {
				submenu.style.left = `${menuRect.right}px`;
				submenu.style.right = 'auto';
				submenuSide = 'right';
			} else {
				submenu.style.right = `${window.innerWidth - menuRect.left}px`;
				submenu.style.left = 'auto';
				submenuSide = 'left';
			}
			submenu.style.top = `${menuRect.top}px`;
			submenu.style.display = 'block';
		}
	}

	function handleMouseMove(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.classList.contains('submenu-trigger')) {
			handleSubmenuPosition(e);
		}
	}

	function handleTriggerMouseLeave(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.classList.contains('submenu-trigger')) {
			const submenu = target.nextElementSibling as HTMLElement | null;
			if (submenu && submenu.classList.contains('submenu-content')) {
				// Check if mouse is moving to submenu - if so, don't hide
				const related = e.relatedTarget as HTMLElement | null;
				if (related && (submenu.contains(related) || related === submenu)) {
					return;
				}
				// Delay hide to allow mouse to reach submenu
				submenu.dataset.hideTimeout = String(setTimeout(() => {
					submenu.style.display = 'none';
				}, 150));
			}
		}
	}

	function handleSubmenuMouseEnter(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const submenu = target.classList.contains('submenu-content')
			? target
			: target.closest?.('.submenu-content') as HTMLElement | null;
		if (submenu) {
			// Cancel pending hide
			const timeout = submenu.dataset.hideTimeout;
			if (timeout) {
				clearTimeout(parseInt(timeout));
				delete submenu.dataset.hideTimeout;
			}
		}
	}

	function handleSubmenuMouseLeave(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.classList.contains('submenu-content')) {
			target.style.display = 'none';
		}
	}

	function handleCrosslistComplete() {
		isOpen = false;
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside, true);
			document.addEventListener('mousemove', handleMouseMove, true);
			document.addEventListener('crosslist-complete', handleCrosslistComplete);

			// Insert caret arrows and add mouse listeners to submenu triggers and content
			requestAnimationFrame(() => {
				const triggers = dropdownRef?.querySelectorAll('.submenu-trigger');
				triggers?.forEach((trigger) => {
					const existingCaret = trigger.querySelector('.caret-arrow');
					if (existingCaret) existingCaret.remove();

					const caret = document.createElement('span');
					caret.className = 'caret-arrow';
					const arrowId = submenuSide === 'right' ? 'arrow-right' : 'arrow-left';
					caret.innerHTML = `<svg width="12" height="12"><use href="#${arrowId}"/></svg>`;
					trigger.insertBefore(caret, trigger.firstChild);

					trigger.addEventListener('mouseenter', handleSubmenuMouseEnter);
					trigger.addEventListener('mouseleave', handleTriggerMouseLeave);
				});

				const submenus = dropdownRef?.querySelectorAll('.submenu-content');
				submenus?.forEach((submenu) => {
					submenu.addEventListener('mouseenter', handleSubmenuMouseEnter);
					submenu.addEventListener('mouseleave', handleSubmenuMouseLeave);
				});
			});
		} else {
			document.removeEventListener('click', handleClickOutside, true);
			document.removeEventListener('mousemove', handleMouseMove, true);
			document.removeEventListener('crosslist-complete', handleCrosslistComplete);
		}
		return () => {
			document.removeEventListener('click', handleClickOutside, true);
			document.removeEventListener('mousemove', handleMouseMove, true);
			document.removeEventListener('crosslist-complete', handleCrosslistComplete);

			// Clean up listeners
			const triggers = dropdownRef?.querySelectorAll('.submenu-trigger');
			triggers?.forEach((trigger) => {
				trigger.removeEventListener('mouseenter', handleSubmenuMouseEnter);
				trigger.removeEventListener('mouseleave', handleTriggerMouseLeave);
			});

			const submenus = dropdownRef?.querySelectorAll('.submenu-content');
			submenus?.forEach((submenu) => {
				submenu.removeEventListener('mouseenter', handleSubmenuMouseEnter);
				submenu.removeEventListener('mouseleave', handleSubmenuMouseLeave);
			});
		};
	});
</script>

<svg style="display:none">
	<symbol id="arrow-right" viewBox="0 0 16 16">
		<path fill="currentColor" d="M6 3l5 5-5 5z"/>
	</symbol>
	<symbol id="arrow-left" viewBox="0 0 16 16">
		<path fill="currentColor" d="M10 3L5 8l5 5z"/>
	</symbol>
</svg>

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
	}

	:global(.dropdown-menu) {
		font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
		min-width: unset !important;
		max-width: unset !important;
		padding: 0.5rem 0;
		margin: 0;
		background-color: #fff;
		background-clip: padding-box;
		border: 1px solid rgba(0, 0, 0, 0.15);
		border-radius: 0.25rem;
		box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);
		z-index: 1000;
	}

	:global(.dropdown-menu li) {
		list-style: none;
	}

	:global(.dropdown-menu .dropdown-item) {
		display: block;
		width: 100%;
		padding: 0.5rem 1rem;
		clear: both;
		color: #212529;
		text-decoration: none;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 1rem;
	}

	:global(.dropdown-menu .dropdown-item:hover) {
		background-color: #f8f9fa;
		color: #16181b;
	}

	:global(.dropdown-menu .submenu-trigger) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		background-color: transparent !important;
	}

	:global(.dropdown-menu .submenu-trigger .caret-arrow) {
		display: inline-flex;
		align-items: center;
		color: #212529;
		flex-shrink: 0;
	}

	:global(.dropdown-menu .submenu-trigger .caret-arrow svg) {
		width: 12px;
		height: 12px;
	}

	:global(.dropdown-menu .submenu-content) {
		display: none;
		position: fixed;
		min-width: 140px;
		padding: 0.5rem 0;
		background-color: #fff;
		background-clip: padding-box;
		border: 1px solid rgba(0, 0, 0, 0.15);
		border-radius: 0.25rem;
		box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);
		z-index: 1001;
	}
</style>