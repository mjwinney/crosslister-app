<script lang="ts">
  import { authClient } from "$lib/auth-client";
	import { goto } from "$app/navigation";

  const session = authClient.useSession();

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

  function handleEbayItems() {
    goto('/ebay-api/inventory_item');
	};

</script>

<svg xmlns="http://www.w3.org/2000/svg" class="d-none">
  <symbol id="bootstrap" viewBox="0 0 118 94">
    <title>Bootstrap</title>
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M24.509 0c-6.733 0-11.715 5.893-11.492 12.284.214 6.14-.064 14.092-2.066 20.577C8.943 39.365 5.547 43.485 0 44.014v5.972c5.547.529 8.943 4.649 10.951 11.153 2.002 6.485 2.28 14.437 2.066 20.577C12.794 88.106 17.776 94 24.51 94H93.5c6.733 0 11.714-5.893 11.491-12.284-.214-6.14.064-14.092 2.066-20.577 2.009-6.504 5.396-10.624 10.943-11.153v-5.972c-5.547-.529-8.934-4.649-10.943-11.153-2.002-6.484-2.28-14.437-2.066-20.577C105.214 5.894 100.233 0 93.5 0H24.508zM80 57.863C80 66.663 73.436 72 62.543 72H44a2 2 0 01-2-2V24a2 2 0 012-2h18.437c9.083 0 15.044 4.92 15.044 12.474 0 5.302-4.01 10.049-9.119 10.88v.277C75.317 46.394 80 51.21 80 57.863zM60.521 28.34H49.948v14.934h8.905c6.884 0 10.68-2.772 10.68-7.727 0-4.643-3.264-7.207-9.012-7.207zM49.948 49.2v16.458H60.91c7.167 0 10.964-2.876 10.964-8.281 0-5.406-3.903-8.178-11.425-8.178H49.948z"
    ></path>
  </symbol>
</svg>

<!-- Header -->
<header class="py-3 mb-3 border-bottom">
  <div
    class="container-fluid d-grid gap-3 align-items-center"
    style="grid-template-columns: 1fr 2fr"
  >
    <div class="d-flex align-items-center">
      <a
        href="#"
        class="d-flex align-items-center col-lg-4 mb-2 mb-lg-0 link-body-emphasis text-decoration-none"
        aria-label="Bootstrap menu"
      >
        <svg class="bi me-2" width="40" height="32" aria-hidden="true">
          <use xlink:href="#bootstrap"></use>
        </svg>
      </a>
      <!-- <ul class="dropdown-menu text-small shadow">
        <li>
          <a class="dropdown-item active" href="#" aria-current="page"
            >Overview</a
          >
        </li>
        <li><a class="dropdown-item" href="#">Inventory</a></li>
        <li><a class="dropdown-item" href="#">Customers</a></li>
        <li><a class="dropdown-item" href="#">Products</a></li>
        <li><hr class="dropdown-divider" /></li>
        <li><a class="dropdown-item" href="#">Reports</a></li>
        <li><a class="dropdown-item" href="#">Analytics</a></li>
      </ul> -->
    </div>
    <div class="d-flex align-items-right justify-content-end">
      {#if $session?.data}
        <button type="button" class="btn btn-primary">
          Log Out
        </button>
      {:else}
        <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#signInModal">
          Sign In
        </button>
      {/if}
    </div>
  </div>
</header>
<!-- header end-->

<style>
.form-control-dark {
  border-color: var(--bs-gray);
}
.form-control-dark:focus {
  border-color: #fff;
  box-shadow: 0 0 0 .25rem rgba(255, 255, 255, .25);
}

.text-small {
  font-size: 85%;
}

.dropdown-toggle:not(:focus) {
  outline: 0;
}
</style>

<!-- <Signin />
<Register /> -->
