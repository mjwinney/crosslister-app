<script lang="ts">
    import { authClient } from "$lib/auth-client";
	import { goto } from "$app/navigation";

//   const session = authClient.useSession();

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

  // async function handleEbayItems() {
  //   goto(`/auth/active-items`);
	// };

	let { children } = $props();
</script>

<main>
  <div class="container-fluid pb-3">
    <div class="d-grid gap-3" style="grid-template-columns: 0fr 1fr">
      <!-- left nav menu -->
      <div class="bg-body-tertiary border rounded-3">
        <div class="flex-shrink-0 p-3" style="width: 200px">
          <ul class="list-unstyled ps-0">
            <li class="mb-1">
              <button
                class="btn btn-toggle d-inline-flex align-items-center rounded border-0 collapsed"
                data-bs-toggle="collapse"
                data-bs-target="#home-collapse"
                aria-expanded="true"
              >
                Inventory
              </button>
              <div class="collapse show" id="home-collapse">
                <ul class="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded" onclick="{() => goto(`/auth/active-items`)}"
                      >Active</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded" onclick="{() => goto(`/auth/scheduled-items`)}"
                      >Scheduled</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded" onclick="{() => goto(`/auth/sold-items`)}"
                      >Sold</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded" onclick="{() => goto('/auth/market-places')}"
                      >Market Places</a
                    >
                  </li>
                </ul>
              </div>
            </li>
            <li class="mb-1">
              <button
                class="btn btn-toggle d-inline-flex align-items-center rounded border-0 collapsed"
                data-bs-toggle="collapse"
                data-bs-target="#dashboard-collapse"
                aria-expanded="false"
              >
                Dashboard
              </button>
              <div class="collapse" id="dashboard-collapse">
                <ul class="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Overview</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Weekly</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Monthly</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Annually</a
                    >
                  </li>
                </ul>
              </div>
            </li>
            <li class="mb-1">
              <button
                class="btn btn-toggle d-inline-flex align-items-center rounded border-0 collapsed"
                data-bs-toggle="collapse"
                data-bs-target="#orders-collapse"
                aria-expanded="false"
              >
                Orders
              </button>
              <div class="collapse" id="orders-collapse">
                <ul class="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >New</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Processed</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Shipped</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Returned</a
                    >
                  </li>
                </ul>
              </div>
            </li>
            <li class="border-top my-3"></li>
            <li class="mb-1">
              <button
                class="btn btn-toggle d-inline-flex align-items-center rounded border-0 collapsed"
                data-bs-toggle="collapse"
                data-bs-target="#account-collapse"
                aria-expanded="false"
              >
                Account
              </button>
              <div class="collapse" id="account-collapse">
                <ul class="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >New...</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Profile</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Settings</a
                    >
                  </li>
                  <li>
                    <a
                      href="#"
                      class="link-body-emphasis d-inline-flex text-decoration-none rounded"
                      >Sign out</a
                    >
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </div>
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

