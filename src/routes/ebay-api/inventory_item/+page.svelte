<script lang="ts">
    import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";
    import { onMount } from "svelte";

    onMount( async () => {
        const session = await authClient.getSession();
        // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
        if (!session || !session?.data) {
            goto('/');
        }
    });
    export let data;
</script>

<div class="row row-cols-1 g-4">
    {#each data.post.GetMyeBaySellingResponse.ActiveList.ItemArray.Item as item}
        <!-- Item Card Example 1 -->
        <div class="col">
            <div class="card item-card">
                <div class="row g-0">
                    <div class="col-md-auto d-flex align-items-center justify-content-center p-3">
                        <div class="form-check me-3">
                            <input class="form-check-input" type="checkbox" value="" id="itemCheckbox1">
                            <label class="form-check-label" for="itemCheckbox1"></label>
                        </div>
                        <img src={item.PictureDetails.GalleryURL} class="border img-fluid item-image" alt={item.Title}>
                    </div>
                    <div class="col-md">
                        <div class="card-body card-body-custom">
                            <div>
                                <h5 class="card-title">{item.Title}</h5>
                                <p class="card-text text-muted">Item ID: {item.ItemID}</p>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-1">
                                <h4 class="mb-0">${item.SellingStatus.CurrentPrice}</h4>
                                <a href="#" class="btn btn-primary btn-sm">View Item</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/each}
</div>

<style>
    .item-card {
        border: 1px solid #dee2e6;
        border-radius: 8px;
        overflow: hidden;
        transition: transform 0.2s ease-in-out;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .item-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 10px rgba(0,0,0,0.15);
    }
    .item-image {
        width: 75px;
        height: 75px;
        object-fit: contain;
        background-color: #f8f9fa;
    }
    .card-body-custom {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .form-check-label {
        cursor: pointer;
    }
</style>
