<script lang="ts">
	import { goto, invalidate } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";

  onMount( async () => {
      const session = await authClient.getSession();
      // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
      if (!session || !session?.data) {
          goto('/homepage');
      }

      // force reload whenever you enter the page
      invalidate('app:dashboard');
  });

  function handlePoshmarkImport() {
    console.log("Poshmark import initiated");

    // Tell extension to start scraping
    window.postMessage({ type: "START_POSHMARK_IMPORT" }, "*");

    // Listen for scraped data
    window.addEventListener("message", (event) => {
      if (event.data.type === "POSHMARK_DATA") {
        console.log("Received Poshmark data:", event.data.data);
        // Display the data in the pre element
        document.getElementById("output").textContent =
          JSON.stringify(event.data.data, null, 2);
      }
    });
  }

  function formatCurrency(amountStr: string): string {
		const amount = parseFloat(amountStr);
		if (isNaN(amount)) {
			throw new Error("Invalid number input");
		}
		return amount.toFixed(2);
	}

  function calculateROI(totalProfit: number, totalCost: number): string {
		// const totalCost = Number(totalPurchasePrice) + Number(totalFees);

    if (totalCost === 0) {
      return '0.00%';
    }

		const roi = (totalProfit / totalCost) * 100;
		return roi.toFixed(2) + '%';
	}

	let { data } = $props();

  const totalWeekProfit = data.post.weekStats.data.grossSales - data.post.weekStats.data.totalFees - data.post.weekStats.data.totalPurchasePrice + data.post.weekStats.data.finalShippingCost;
  const totalPrevWeekProfit = data.post.previousWeekStats.data.grossSales - data.post.previousWeekStats.data.totalFees - data.post.previousWeekStats.data.totalPurchasePrice + data.post.previousWeekStats.data.finalShippingCost;
  const totalWeekROI = calculateROI(totalWeekProfit, data.post.weekStats.data.totalPurchasePrice + data.post.weekStats.data.totalFees - data.post.weekStats.data.finalShippingCost);
  const totalPrevWeekROI = calculateROI(totalPrevWeekProfit, data.post.previousWeekStats.data.totalPurchasePrice + data.post.previousWeekStats.data.totalFees - data.post.previousWeekStats.data.finalShippingCost);

  const totalPreviousMonthProfit = data.post.previousMonthStats.data.grossSales - data.post.previousMonthStats.data.totalFees - data.post.previousMonthStats.data.totalPurchasePrice + data.post.previousMonthStats.data.finalShippingCost;
  const totalLast6MonthProfit = data.post.last6MonthStats.data.grossSales - data.post.last6MonthStats.data.totalFees - data.post.last6MonthStats.data.totalPurchasePrice + data.post.last6MonthStats.data.finalShippingCost;
  const totalPreviousMonthROI = calculateROI(totalPreviousMonthProfit, data.post.previousMonthStats.data.totalPurchasePrice + data.post.previousMonthStats.data.totalFees - data.post.previousMonthStats.data.finalShippingCost);
  const totalLast6MonthROI = calculateROI(totalLast6MonthProfit, data.post.last6MonthStats.data.totalPurchasePrice + data.post.last6MonthStats.data.totalFees - data.post.last6MonthStats.data.finalShippingCost);

</script>

<h1>Dashboard</h1>

<div class="container">

  <button class="btn btn-primary" id="importBtn" onclick={() => handlePoshmarkImport()}>Import from Poshmark</button>
  <pre id="output"></pre>

  <div class="d-flex flex-wrap justify-content-left gap-4">
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
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Items Sold</td>
              <td>{data.post.weekStats.data.itemCount}</td>
              <td>{data.post.previousWeekStats.data.itemCount}</td>
            </tr>
            <tr>
              <td>Gross Sales</td>
              <td class="text-success">${formatCurrency(data.post.weekStats.data.grossSales)}</td>
              <td class="text-success">${formatCurrency(data.post.previousWeekStats.data.grossSales)}</td>
            </tr>
            <tr>
              <td>Total Fees</td>
              <td class="text-danger">${formatCurrency(data.post.weekStats.data.totalFees)}</td>
              <td class="text-danger">${formatCurrency(data.post.previousWeekStats.data.totalFees)}</td>
            </tr>
            <tr>
              <td>Shipping</td>
              {#if data.post.weekStats.data.finalShippingCost > 0}
                <td class="text-success">${formatCurrency(data.post.weekStats.data.finalShippingCost)}</td>
              {:else}
                <td class="text-danger">${formatCurrency(Math.abs(data.post.weekStats.data.finalShippingCost).toFixed(2))}</td>
              {/if}
              {#if data.post.previousWeekStats.data.finalShippingCost > 0}
                <td class="text-success">${formatCurrency(data.post.previousWeekStats.data.finalShippingCost)}</td>
              {:else}
                <td class="text-danger">${formatCurrency(Math.abs(data.post.previousWeekStats.data.finalShippingCost).toFixed(2))}</td>
              {/if  }
            </tr>
            <tr>
              <td>COG</td>
              <td class="text-danger">${formatCurrency(data.post.weekStats.data.totalPurchasePrice)}</td>
              <td class="text-danger">${formatCurrency(data.post.previousWeekStats.data.totalPurchasePrice)}</td>
            </tr>
            <tr>
              <td>Net Sales</td>
              <td class="text-success">${formatCurrency(totalWeekProfit.toString())}</td>
              <td class="text-success">${formatCurrency(totalPrevWeekProfit.toString())}</td>
            </tr>
            <tr>
              <td>ROI</td>
              <td>{totalWeekROI}</td>
              <td>{totalPrevWeekROI}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="card mb-4 rounded-3 shadow-sm" style="max-width: 24rem;">
        <div class="card-header py-3">
            <h4 class="my-0 fw-normal">Monthly Sales Overview</h4>
        </div>
      <div class="card-body">
        <h4 class="card-title">Sales Metrics</h4>
        <table class="table table-sm table-bordered text-white">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Last Month</th>
              <th>Last 6 Months</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Items Sold</td>
              <td>{data.post.previousMonthStats.data.itemCount}</td>
              <td>{data.post.last6MonthStats.data.itemCount}</td>
            </tr>
            <tr>
              <td>Gross Sales</td>
              <td class="text-success">${formatCurrency(totalPreviousMonthProfit)}</td>
              <td class="text-success">${formatCurrency(totalLast6MonthProfit)}</td>
            </tr>
            <tr>
              <td>Total Fees</td>
              <td class="text-danger">${formatCurrency(data.post.previousMonthStats.data.totalFees)}</td>
              <td class="text-danger">${formatCurrency(data.post.last6MonthStats.data.totalFees)}</td>
            </tr>
            <tr>
              <td>Shipping</td>
              {#if data.post.previousMonthStats.data.finalShippingCost > 0}
                <td class="text-success">${formatCurrency(data.post.previousMonthStats.data.finalShippingCost)}</td>
              {:else}
                <td class="text-danger">${formatCurrency(Math.abs(data.post.previousMonthStats.data.finalShippingCost).toFixed(2))}</td>
              {/if}
              {#if data.post.last6MonthStats.data.finalShippingCost > 0}
                <td class="text-success">${formatCurrency(data.post.last6MonthStats.data.finalShippingCost)}</td>
              {:else}
                <td class="text-danger">${formatCurrency(Math.abs(data.post.last6MonthStats.data.finalShippingCost).toFixed(2))}</td>
              {/if  }
            </tr>
            <tr>
              <td>COG</td>
              <td class="text-danger">${formatCurrency(data.post.previousMonthStats.data.totalPurchasePrice)}</td>
              <td class="text-danger">${formatCurrency(data.post.last6MonthStats.data.totalPurchasePrice)}</td>
            </tr>
            <tr>
              <td>Net Sales</td>
              <td class="text-success">${formatCurrency(totalPrevWeekProfit.toString())}</td>
              <td class="text-success">${formatCurrency(totalLast6MonthProfit.toString())}</td>
            </tr>
            <tr>
              <td>ROI</td>
              <td>{totalPreviousMonthROI}</td>
              <td>{totalLast6MonthROI}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
