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
            <button class="page-link" aria-label="Previous" on:click={() => change(page - 1)} disabled={page === 1 || disabled}>
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
                        on:click={() => change(Number(p))}
                        disabled={disabled}
                    >
                        {p}
                    </button>
                </li>
            {/if}
        {/each}

        <li class="page-item {page === totalPages || disabled ? 'disabled' : ''}">
            <button class="page-link" aria-label="Next" on:click={() => change(page + 1)} disabled={page === totalPages || disabled}>
                <span aria-hidden="true">&raquo;</span>
            </button>
        </li>
    </ul>
</nav>

<style>
    /* Minimal adjustments for consistent sizing — keep visuals in consumer CSS (Bootstrap/etc.) */
    .pagination { margin: 0; }
    button.page-link { cursor: pointer; }
    .page-item.disabled > .page-link { cursor: not-allowed; }
</style>