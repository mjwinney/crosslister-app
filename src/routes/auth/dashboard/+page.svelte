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

  function formatCurrency(amountStr: string): string {
		const amount = parseFloat(amountStr);
		if (isNaN(amount)) {
			throw new Error("Invalid number input");
		}
		return amount.toFixed(2);
	}

  function calculateROI(totalProfit: number, totalPurchasePrice: string, totalFees: string): string {
		const totalCost = Number(totalPurchasePrice) + Number(totalFees);

    if (totalCost === 0) {
      return '0.00%';
    }

		const roi = (totalProfit / totalCost) * 100;
		return roi.toFixed(2) + '%';
	}

	let { data } = $props();

  const totalWeekProfit = data.post.weekStats.data.grossSales - data.post.weekStats.data.totalFees - data.post.weekStats.data.totalPurchasePrice;
  const totalPrevWeekProfit = data.post.previousWeekStats.data.grossSales - data.post.previousWeekStats.data.totalFees - data.post.previousWeekStats.data.totalPurchasePrice;
  const totalWeekROI = calculateROI(totalWeekProfit, data.post.weekStats.data.totalPurchasePrice, data.post.weekStats.data.totalFees);
  const totalPrevWeekROI = calculateROI(totalPrevWeekProfit, data.post.previousWeekStats.data.totalPurchasePrice, data.post.previousWeekStats.data.totalFees);

  const totalPreviousMonthProfit = data.post.previousMonthStats.data.grossSales - data.post.previousMonthStats.data.totalFees - data.post.previousMonthStats.data.totalPurchasePrice;
  const totalLast6MonthProfit = data.post.last6MonthStats.data.grossSales - data.post.last6MonthStats.data.totalFees - data.post.last6MonthStats.data.totalPurchasePrice;
  const totalPreviousMonthROI = calculateROI(totalPreviousMonthProfit, data.post.previousMonthStats.data.totalPurchasePrice, data.post.previousMonthStats.data.totalFees);
  const totalLast6MonthROI = calculateROI(totalLast6MonthProfit, data.post.last6MonthStats.data.totalPurchasePrice, data.post.last6MonthStats.data.totalFees);

</script>

<h1>Dashboard</h1>

<div class="container">
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
              <td>Total Cost</td>
              <td class="text-danger">${formatCurrency(data.post.weekStats.data.totalPurchasePrice)}</td>
              <td class="text-danger">${formatCurrency(data.post.previousWeekStats.data.totalPurchasePrice)}</td>
            </tr>
            <tr>
              <td>Net Profit</td>
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
              <td>Total Cost</td>
              <td class="text-danger">${formatCurrency(data.post.previousMonthStats.data.totalPurchasePrice)}</td>
              <td class="text-danger">${formatCurrency(data.post.last6MonthStats.data.totalPurchasePrice)}</td>
            </tr>
            <tr>
              <td>Net Profit</td>
              <td class="text-success">${formatCurrency(totalPreviousMonthROI.toString())}</td>
              <td class="text-success">${formatCurrency(totalLast6MonthProfit.toString())}</td>
            </tr>
            <tr>
              <td>ROI</td>
              <td>{totalWeekROI}</td>
              <td>{totalLast6MonthROI}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
