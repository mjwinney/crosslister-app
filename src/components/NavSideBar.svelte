<script lang="ts">
  import { authClient } from "$lib/auth-client";
	import { goto } from "$app/navigation";

  function handleLogout() {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          goto('/'); // Goto the homepage
        },
      },
    });
  };

	function handleEbayAuth() {
    goto('/ebay-api/auth');
	};

	let { children } = $props();
</script>

<main>
  <div class="container-fluid pb-3">
    <div class="sidebar-layout">
      <!-- left nav menu -->
      <aside class="sidebar-panel">
        <div class="accordion" id="sidebarAccordion">
  <!-- Dashboard Section -->
  <div class="accordion-item">
    <h2 class="accordion-header" id="headingInventory">
      <button class="accordion-button collapsed" type="button"
        data-bs-toggle="collapse"
        data-bs-target="#collapseDashboard"
        aria-expanded="false"
        aria-controls="collapseDashboard">
        Dashboard
      </button>
    </h2>
    <div id="collapseDashboard" class="accordion-collapse collapse"
      aria-labelledby="headingDashboard"
      data-bs-parent="#sidebarAccordion">
      <div class="accordion-body">
        <ul class="list-unstyled fw-normal pb-1 small">
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded" href="#" onclick={() => goto('/auth/dashboard')}>Dashboard</a></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Ebay Inventory Section -->
  <div class="accordion-item">
    <h2 class="accordion-header" id="ebayheadingInventory">
      <button class="accordion-button collapsed" type="button"
        data-bs-toggle="collapse"
        data-bs-target="#collapseEbayInventory"
        aria-expanded="false"
        aria-controls="collapseEbayInventory">
        Ebay
      </button>
    </h2>
    <div id="collapseEbayInventory" class="accordion-collapse collapse"
      aria-labelledby="ebayheadingInventory"
      data-bs-parent="#sidebarAccordion">
      <div class="accordion-body">
        <ul class="list-unstyled fw-normal pb-1 small">
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/active-items')}>Active</a></li>
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/scheduled-items')}>Scheduled</a></li>
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/sold-items')}>Sold</a></li>
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/unsold-items')}>Unsold</a></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Poshmark Section -->
  <div class="accordion-item">
    <h2 class="accordion-header" id="poshmarkheadingInventory">
      <button class="accordion-button collapsed" type="button"
        data-bs-toggle="collapse"
        data-bs-target="#collapsePoshmarkInventory"
        aria-expanded="false"
        aria-controls="collapsePoshmarkInventory">
        Poshmark
      </button>
    </h2>
    <div id="collapsePoshmarkInventory" class="accordion-collapse collapse"
      aria-labelledby="poshmarkheadingInventory"
      data-bs-parent="#sidebarAccordion">
      <div class="accordion-body">
        <ul class="list-unstyled fw-normal pb-1 small">
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/poshmark-dashboard')}>Dashboard</a></li>
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/poshmark-active-items')}>Active</a></li>
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/poshmark-sold-items')}>Sold</a></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Reports Section -->
  <!-- <div class="accordion-item">
    <h2 class="accordion-header" id="headingReports">
      <button class="accordion-button collapsed" type="button"
        data-bs-toggle="collapse"
        data-bs-target="#collapseReports"
        aria-expanded="false"
        aria-controls="collapseReports">
        Reports
      </button>
    </h2>
    <div id="collapseReports" class="accordion-collapse collapse"
      aria-labelledby="headingReports"
      data-bs-parent="#sidebarAccordion">
      <div class="accordion-body">
        <ul class="list-unstyled fw-normal pb-1 small">
          <li><a href="#">Monthly</a></li>
          <li><a href="#">Annual</a></li>
        </ul>
      </div>
    </div>
  </div> -->

  <!-- Settings Section -->
  <!-- <div class="accordion-item">
    <h2 class="accordion-header" id="headingSettings">
      <button class="accordion-button collapsed" type="button"
        data-bs-toggle="collapse"
        data-bs-target="#collapseSettings"
        aria-expanded="false"
        aria-controls="collapseSettings">
        Settings
      </button>
    </h2>
    <div id="collapseSettings" class="accordion-collapse collapse"
      aria-labelledby="headingSettings"
      data-bs-parent="#sidebarAccordion">
      <div class="accordion-body">
        <ul class="list-unstyled fw-normal pb-1 small">
          <li><a href="#">Profile</a></li>
          <li><a href="#">Preferences</a></li>
        </ul>
      </div>
    </div>
  </div> -->
        </div>
      </aside>
      <!-- left nav menu end -->
      <!-- main content -->
      <section class="content-panel">
        <!-- Main content goes here -->
        {@render children()}
      </section>
    </div>
  </div>
</main>

<style>
  :global(html) {
    height: 100%;
  }

  :global(body) {
    min-height: 100%;
    margin: 0;
    background: #07111f;
    font-family: "Space Grotesk", "Trebuchet MS", sans-serif;
    color: #edf6ff;
  }

  main {
    min-height: calc(100vh - 74px);
    overflow-x: hidden;
    background:
      radial-gradient(circle at 8% 0%, rgba(124, 58, 237, 0.14), transparent 26rem),
      linear-gradient(135deg, #040b14 0%, #0a1628 48%, #07111f 100%);
  }

  .container-fluid {
    padding: clamp(1rem, 2vw, 2rem) !important;
  }

  .sidebar-layout {
    display: grid;
    grid-template-columns: minmax(165px, 188px) minmax(0, 1fr);
    gap: clamp(1rem, 2vw, 1.5rem);
    align-items: start;
    max-width: 1800px;
    margin: 0 auto;
  }

  .sidebar-panel,
  .content-panel {
    position: relative;
    min-width: 0;
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: 8px;
    background:
      linear-gradient(rgba(148, 163, 184, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.035) 1px, transparent 1px),
      linear-gradient(145deg, rgba(7, 17, 31, 0.98), rgba(4, 11, 20, 0.96));
    background-size: 28px 28px, 28px 28px, auto;
    box-shadow: 0 12px 32px rgba(4, 11, 20, 0.22);
  }

  .sidebar-panel {
    position: sticky;
    top: 1rem;
    overflow: hidden;
  }

  .content-panel {
    min-height: calc(100vh - 122px);
    overflow: auto;
    background: transparent;
    box-shadow: none;
  }

  .sidebar-panel :global(.accordion) {
    --bs-accordion-bg: transparent;
    --bs-accordion-color: #dbeafe;
    --bs-accordion-border-color: rgba(148, 163, 184, 0.16);
    --bs-accordion-btn-color: #edf6ff;
    --bs-accordion-btn-bg: transparent;
    --bs-accordion-active-color: #fff;
    --bs-accordion-active-bg: rgba(124, 58, 237, 0.16);
    --bs-accordion-btn-focus-box-shadow: 0 0 0 0.18rem rgba(34, 211, 238, 0.14);
    border: 0;
  }

  .sidebar-panel :global(.accordion-item) {
    border-color: rgba(148, 163, 184, 0.16);
    background: transparent;
  }

  .sidebar-panel :global(.accordion-button) {
    min-height: 3.25rem;
    padding: 0.9rem 1rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: #edf6ff;
    background: transparent;
    box-shadow: none;
  }

  .sidebar-panel :global(.accordion-button)::after {
    width: 0.8rem;
    height: 0.8rem;
    background-image: none;
    border-right: 2px solid #8da3ba;
    border-bottom: 2px solid #8da3ba;
    transform: rotate(45deg);
    transition: transform 180ms ease, border-color 180ms ease;
  }

  .sidebar-panel :global(.accordion-button:not(.collapsed))::after {
    border-color: #67e8f9;
    transform: translateY(3px) rotate(225deg);
  }

  .sidebar-panel :global(.accordion-button:hover),
  .sidebar-panel :global(.accordion-button:focus-visible) {
    color: #fff;
    background: rgba(124, 58, 237, 0.2);
  }

  .sidebar-panel :global(.accordion-button:focus-visible) {
    box-shadow: inset 3px 0 #22d3ee, 0 0 0 0.18rem rgba(34, 211, 238, 0.14);
  }

  .sidebar-panel :global(.accordion-button:not(.collapsed)) {
    color: #fff;
    background: rgba(124, 58, 237, 0.2);
  }

  .sidebar-panel :global(.accordion-collapse) {
    background: rgba(4, 11, 20, 0.42);
  }

  .sidebar-panel :global(.accordion-body) {
    padding: 0.55rem 0.75rem 0.7rem;
  }

  .sidebar-panel :global(.accordion-body a) {
    width: 100%;
    padding: 0.48rem 0.7rem;
    font-size: 0.875rem !important;
    color: #9fb2c8 !important;
    transition: color 180ms ease, background-color 180ms ease, padding-left 180ms ease;
  }

  .sidebar-panel :global(.accordion-body a:hover),
  .sidebar-panel :global(.accordion-body a:focus-visible) {
    padding-left: 0.9rem;
    color: #fff !important;
    background: rgba(34, 211, 238, 0.12);
    outline: none;
  }

  @media (max-width: 720px) {
    .sidebar-layout {
      grid-template-columns: 1fr;
    }

    .sidebar-panel {
      position: static;
    }

    .content-panel {
      min-height: 0;
    }
  }
</style>

