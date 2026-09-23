<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const props = $props<{
        page?: number;
        totalPages?: number;
        maxPagesToShow?: number;
        disabled?: boolean;
        onPageChange?: (p: number) => void;
    }>();

    // reactive state variables
    let page = $state(props.page ?? 1);
    let totalPages = $state(props.totalPages ?? 1);
    let maxPagesToShow = $state(props.maxPagesToShow ?? 7);
    let disabled = $state(props.disabled ?? false);
    let onPageChange = props.onPageChange;

    // keep state in sync when parent updates props
    $effect(() => {
        page = props.page ?? 1;
        totalPages = props.totalPages ?? 1;
        maxPagesToShow = props.maxPagesToShow ?? 7;
        disabled = props.disabled ?? false;
        onPageChange = props.onPageChange;
    });

    const dispatch = createEventDispatcher();

    function change(to: number) {
        if (disabled) return;
        to = Math.max(1, Math.min(totalPages, Math.floor(to)));
        if (to === page) return;
        if (typeof onPageChange === 'function') {
            onPageChange(to);
        } else {
            dispatch('pagechange', { page: to });
        }
    }

    // returns array of numbers and '...' markers
    function getPageRange(): (number | '...')[] {
        const total = totalPages;
        const current = page;
        const max = Math.max(5, maxPagesToShow); // minimum sensible
        const pages: (number | '...')[] = [];

        if (total <= max) {
            for (let i = 1; i <= total; i++) pages.push(i);
            return pages;
        }

        const side = Math.floor((max - 3) / 2); // space around current
        let left = Math.max(2, current - side);
        let right = Math.min(total - 1, current + side);

        // adjust when close to edges
        if (current - 1 <= side) {
            left = 2;
            right = Math.max(2, max - 2);
        }
        if (total - current <= side) {
            right = total - 1;
            left = Math.min(total - 1 - (max - 3), total - 1);
        }

        pages.push(1);
        if (left > 2) pages.push('...');
        for (let i = left; i <= right; i++) pages.push(i);
        if (right < total - 1) pages.push('...');
        pages.push(total);

        return pages;
    }
</script>

<nav aria-label="Pagination">
    <ul class="pagination">
        <li class="page-item {page === 1 || disabled ? 'disabled' : ''}">
            <button class="page-link" aria-label="Previous" onclick={() => change(page - 1)} disabled={page === 1 || disabled}>
                <span aria-hidden="true">&laquo;</span>
            </button>
        </li>

        {#each getPageRange() as p}
            {#if p === '...'}
                <li class="page-item disabled"><span class="page-link">…</span></li>
            {:else}
                <li class="page-item {p === page ? 'active' : ''}">
                    <button
                        class="page-link"
                        aria-current={p === page ? 'page' : undefined}
                        onclick={() => change(Number(p))}
                        disabled={disabled}
                    >
                        {p}
                    </button>
                </li>
            {/if}
        {/each}

        <li class="page-item {page === totalPages || disabled ? 'disabled' : ''}">
            <button class="page-link" aria-label="Next" onclick={() => change(page + 1)} disabled={page === totalPages || disabled}>
                <span aria-hidden="true">&raquo;</span>
            </button>
        </li>
    </ul>
</nav>

<style>
    :global(.pagination) {
        margin: 0;
    }

    :global(.page-link) {
        display: inline-flex;
        min-width: 38px;
        min-height: 38px;
        align-items: center;
        justify-content: center;
        padding: 0.375rem 0.75rem;
        color: #dbeafe;
        background: rgba(15, 36, 62, 0.82);
        border: 0;
        border-radius: 8px;
        box-shadow: 0 5px 14px rgba(4, 11, 20, 0.2);
        transition: color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    :global(.page-item:not(.active):not(.disabled) .page-link:hover),
    :global(.page-item:not(.active):not(.disabled) .page-link:focus-visible) {
        color: #fff;
        background: rgba(124, 58, 237, 0.42);
        box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2), 0 5px 14px rgba(4, 11, 20, 0.2);
    }

    :global(.page-item.active .page-link) {
        color: #fff;
        background: linear-gradient(135deg, #7c3aed, #22d3ee);
        border: 0;
        box-shadow: 0 8px 24px rgba(124, 58, 237, 0.32);
    }

    :global(.page-item.disabled .page-link),
    :global(.page-link:disabled) {
        color: #7890aa;
        background: rgba(15, 36, 62, 0.5);
        border: 0;
        opacity: 0.6;
        cursor: not-allowed;
        box-shadow: none;
    }
</style>