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

</script>

<nav aria-label="Pagination">
    <ul class="pagination">
        <li class="page-item {page === 1 || disabled ? 'disabled' : ''}">
            <button class="page-link navigation-link" aria-label="First page" onclick={() => change(1)} disabled={page === 1 || disabled}>
                <span aria-hidden="true">&laquo;</span>
            </button>
        </li>

        <li class="page-item {page === 1 || disabled ? 'disabled' : ''}">
            <button class="page-link navigation-link" aria-label="Previous page" onclick={() => change(page - 1)} disabled={page === 1 || disabled}>
                <span aria-hidden="true">&lsaquo;</span>
            </button>
        </li>

        <li class="page-item active">
            <button class="page-link" aria-current="page" onclick={() => change(page)} disabled={disabled}>{page}</button>
        </li>

        <li class="page-item {page === totalPages || disabled ? 'disabled' : ''}">
            <button class="page-link navigation-link" aria-label="Next page" onclick={() => change(page + 1)} disabled={page === totalPages || disabled}>
                <span aria-hidden="true">&rsaquo;</span>
            </button>
        </li>

        <li class="page-item {page === totalPages || disabled ? 'disabled' : ''}">
            <button class="page-link navigation-link" aria-label="Last page" onclick={() => change(totalPages)} disabled={page === totalPages || disabled}>
                <span aria-hidden="true">&raquo;</span>
            </button>
        </li>
    </ul>
</nav>

<style>
    :global(.pagination) {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        padding: 0;
        list-style: none;
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

    :global(.navigation-link) {
        min-width: 44px;
        min-height: 44px;
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1;
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