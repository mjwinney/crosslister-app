<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		placeholder?: string;
		disabled?: boolean;
		onSearch?: (query: string) => void;
		onClear?: () => void;
	}

	const { placeholder = 'Search...', disabled = false, onSearch, onClear } = $props();

	const dispatch = createEventDispatcher();

	let searchQuery = $state('');

	function handleSearch() {
		const trimmedQuery = searchQuery.trim();
		if (trimmedQuery.length >= 3) {
			if (typeof onSearch === 'function') {
				onSearch(trimmedQuery);
			} else {
				dispatch('search', { query: trimmedQuery });
			}
		}
	}

	function handleClear() {
		searchQuery = '';
		if (typeof onClear === 'function') {
			onClear();
		} else {
			dispatch('clear');
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSearch();
		}
	}

	let isSearchDisabled = $derived(disabled || searchQuery.trim().length < 3);
</script>

<div class="search-bar-container d-flex gap-2">
	<div class="search-input-wrapper flex-grow-1" style="position:relative;">
		<input
			type="text"
			class="form-control"
			{placeholder}
			bind:value={searchQuery}
			onkeydown={handleKeyDown}
			{disabled}
			aria-label="Search query"
			style="padding-right:2.25rem;"
		/>

		{#if searchQuery && searchQuery.length > 0}
			<button class="clear-btn" onclick={handleClear} aria-label="Clear search" title="Clear search" type="button">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
					<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
				</svg>
			</button>
		{/if}

	</div>

	<button
		class="btn btn-primary d-flex align-items-center justify-content-center ms-2"
		onclick={handleSearch}
		disabled={isSearchDisabled}
		aria-label="Search"
		title="Search (minimum 3 characters)"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			fill="currentColor"
			viewBox="0 0 16 16"
			class="me-1"
		>
			<path
				d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.364.362.738.71l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.007-.007ZM12.5 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z"
			/>
		</svg>
		Search
	</button>
</div>

<style>
	.search-bar-container {
		min-width: 300px;
	}

	.search-input-wrapper { position: relative; }

	.clear-btn {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		border: none;
		background: transparent;
		padding: 0.125rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #6c757d;
	}

	.clear-btn svg { width: 16px; height: 16px; }

	button:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	button:not(:disabled) {
		cursor: pointer;
	}

	svg {
		display: inline-block;
	}
</style>
