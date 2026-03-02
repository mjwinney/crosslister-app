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
    <div class="d-grid gap-3" style="grid-template-columns: 0fr 1fr">
      <!-- left nav menu -->
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
          <!-- <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/active-items')}>Active</a></li> -->
          <!-- <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/scheduled-items')}>Scheduled</a></li> -->
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/poshmark-sold-items')}>Sold</a></li>
          <!-- <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/unsold-items')}>Unsold</a></li> -->
          <!-- <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded" href="#" onclick={() => goto('/auth/market-places')}>Market Places</a></li> -->
          <li><a class="link-body-emphasis d-inline-flex text-decoration-none rounded mb-2" href="#" onclick={() => goto('/auth/poshmark-cross-list')}>Cross list</a></li>
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
      <!-- left nav menu end -->
      <!-- main content -->
      <div class="bg-body-tertiary border rounded-3">
        <!-- Main content goes here -->
        {@render children()}
      </div>
    </div>
  </div>
</main>

<style>

.accordion-body a {
  font-size: 14px !important;
}

body {
  min-height: 100vh;
  min-height: -webkit-fill-available;
}

html {
  height: -webkit-fill-available;
}

main {
  height: 100vh;
  height: -webkit-fill-available;
  max-height: 100vh;
  overflow-x: auto;
  overflow-y: hidden;
}

.dropdown-toggle { outline: 0; }

.btn-toggle {
  padding: .25rem .5rem;
  font-weight: 600;
  color: var(--bs-emphasis-color);
  background-color: transparent;
}
.btn-toggle:hover,
.btn-toggle:focus {
  color: rgba(var(--bs-emphasis-color-rgb), .85);
  background-color: var(--bs-tertiary-bg);
}

.btn-toggle::before {
  width: 1.25em;
  line-height: 0;
  content: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='rgba%280,0,0,.5%29' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 14l6-6-6-6'/%3e%3c/svg%3e");
  transition: transform .35s ease;
  transform-origin: .5em 50%;
}

[data-bs-theme="dark"] .btn-toggle::before {
  content: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='rgba%28255,255,255,.5%29' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 14l6-6-6-6'/%3e%3c/svg%3e");
}

.btn-toggle[aria-expanded="true"] {
  color: rgba(var(--bs-emphasis-color-rgb), .85);
}
.btn-toggle[aria-expanded="true"]::before {
  transform: rotate(90deg);
}

.btn-toggle-nav a {
  padding: .1875rem .5rem;
  margin-top: .125rem;
  margin-left: 1.25rem;
}
.btn-toggle-nav a:hover,
.btn-toggle-nav a:focus {
  background-color: var(--bs-tertiary-bg);
}

.scrollarea {
  overflow-y: auto;
}
</style>

