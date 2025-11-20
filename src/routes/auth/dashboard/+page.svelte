<script lang="ts">
	import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";

    onMount( async () => {
        const session = await authClient.getSession();
        // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
        if (!session || !session?.data) {
            goto('/homepage');
        }
	});

	let { data } = $props();
</script>

<h1>Dashboard</h1>

<div class="card mb-4 rounded-3 shadow-sm" style="max-width: 24rem;">
    <div class="card-header py-3">
        <h4 class="my-0 fw-normal">Weekly Sales Overview</h4>
    </div>
  <div class="card-body">
    <h4 class="card-title">Sales Metrics</h4>
    <table class="table table-sm table-bordered text-white">
      <thead>
        <tr>
          <th>Metric</th>
          <th>This Week</th>
          <th>Last Week</th>
          <th>Last Month</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Items Sold</td>
          <td>{data.post.weekStats.data.itemCount}</td>
          <td>{data.post.previousWeekStats.data.itemCount}</td>
          <td>{data.post.previousMonthStats.data.itemCount}</td>
        </tr>
        <tr>
          <td>Gross Sales</td>
          <td>$3,600</td>
          <td>$2,850</td>
          <td>$2,850</td>
        </tr>
        <tr>
          <td>Net Sales</td>
          <td>$3,000</td>
          <td>$2,400</td>
          <td>$2,400</td>
        </tr>
        <tr>
          <td>ROI</td>
          <td>25%</td>
          <td>20%</td>
          <td>20%</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
