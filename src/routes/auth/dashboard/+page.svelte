<script lang="ts">
	import { goto, invalidate } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";

  onMount( async () => {
      const session = await authClient.getSession();
      // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
      if (!session || !session?.data) {
          goto('/');
      }

      // force reload whenever you enter the page
      invalidate('app:dashboard');
  });

  function formatCurrency(amount: string | number): string {
		const numericAmount = Number(amount);
		if (Number.isNaN(numericAmount)) {
			throw new Error("Invalid number input");
		}
		return numericAmount.toFixed(2);
	}

  function calculateROI(totalProfit: number, totalCost: number): string {
		if (totalCost === 0) {
      return '0.00%';
    }

		const roi = (totalProfit / totalCost) * 100;
		return roi.toFixed(2) + '%';
	}

	let { data } = $props();

  type DashboardSummary = {
    itemCount: number;
    grossSales: number;
    totalFees: number;
    totalPurchasePrice: number;
    finalShippingCost: number;
  };

  const emptySummary: DashboardSummary = {
    itemCount: 0,
    grossSales: 0,
    totalFees: 0,
    totalPurchasePrice: 0,
    finalShippingCost: 0
  };

  function normalizeSummary(value: unknown): DashboardSummary {
    if (value && typeof value === 'object') {
      const candidate = value as Partial<DashboardSummary>;
      return {
        itemCount: Number(candidate.itemCount ?? 0),
        grossSales: Number(candidate.grossSales ?? 0),
        totalFees: Number(candidate.totalFees ?? 0),
        totalPurchasePrice: Number(candidate.totalPurchasePrice ?? 0),
        finalShippingCost: Number(candidate.finalShippingCost ?? 0)
      };
    }

    return emptySummary;
  }

  const weekStats = $derived(normalizeSummary(data?.post?.weekStats));
  const previousWeekStats = $derived(normalizeSummary(data?.post?.previousWeekStats));
  const previousMonthStats = $derived(normalizeSummary(data?.post?.previousMonthStats));
  const last6MonthStats = $derived(normalizeSummary(data?.post?.last6MonthStats));

  const totalWeekProfit = $derived((weekStats.grossSales ?? 0) - (weekStats.totalFees ?? 0) - (weekStats.totalPurchasePrice ?? 0) + (weekStats.finalShippingCost ?? 0));
  const totalPrevWeekProfit = $derived((previousWeekStats.grossSales ?? 0) - (previousWeekStats.totalFees ?? 0) - (previousWeekStats.totalPurchasePrice ?? 0) + (previousWeekStats.finalShippingCost ?? 0));
  const totalWeekROI = $derived(calculateROI(totalWeekProfit, (weekStats.totalPurchasePrice ?? 0) + (weekStats.totalFees ?? 0) - (weekStats.finalShippingCost ?? 0)));
  const totalPrevWeekROI = $derived(calculateROI(totalPrevWeekProfit, (previousWeekStats.totalPurchasePrice ?? 0) + (previousWeekStats.totalFees ?? 0) - (previousWeekStats.finalShippingCost ?? 0)));

  const totalPreviousMonthProfit = $derived((previousMonthStats.grossSales ?? 0) - (previousMonthStats.totalFees ?? 0) - (previousMonthStats.totalPurchasePrice ?? 0) + (previousMonthStats.finalShippingCost ?? 0));
  const totalLast6MonthProfit = $derived((last6MonthStats.grossSales ?? 0) - (last6MonthStats.totalFees ?? 0) - (last6MonthStats.totalPurchasePrice ?? 0) + (last6MonthStats.finalShippingCost ?? 0));
  const totalPreviousMonthROI = $derived(calculateROI(totalPreviousMonthProfit, (previousMonthStats.totalPurchasePrice ?? 0) + (previousMonthStats.totalFees ?? 0) - (previousMonthStats.finalShippingCost ?? 0)));
  const totalLast6MonthROI = $derived(calculateROI(totalLast6MonthProfit, (last6MonthStats.totalPurchasePrice ?? 0) + (last6MonthStats.totalFees ?? 0) - (last6MonthStats.finalShippingCost ?? 0)));

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
              <td>{weekStats.itemCount}</td>
              <td>{previousWeekStats.itemCount}</td>
            </tr>
            <tr>
              <td>Gross Sales</td>
              <td class="text-success">${formatCurrency(weekStats.grossSales ?? 0)}</td>
              <td class="text-success">${formatCurrency(previousWeekStats.grossSales ?? 0)}</td>
            </tr>
            <tr>
              <td>Total Fees</td>
              <td class="text-danger">${formatCurrency(weekStats.totalFees ?? 0)}</td>
              <td class="text-danger">${formatCurrency(previousWeekStats.totalFees ?? 0)}</td>
            </tr>
            <tr>
              <td>Shipping</td>
              {#if (weekStats.finalShippingCost ?? 0) > 0}
                <td class="text-success">${formatCurrency(weekStats.finalShippingCost ?? 0)}</td>
              {:else}
                <td class="text-danger">${formatCurrency(Math.abs(weekStats.finalShippingCost ?? 0).toFixed(2))}</td>
              {/if}
              {#if (previousWeekStats.finalShippingCost ?? 0) > 0}
                <td class="text-success">${formatCurrency(previousWeekStats.finalShippingCost ?? 0)}</td>
              {:else}
                <td class="text-danger">${formatCurrency(Math.abs(previousWeekStats.finalShippingCost ?? 0).toFixed(2))}</td>
              {/if}
            </tr>
            <tr>
              <td>COG</td>
              <td class="text-danger">${formatCurrency(weekStats.totalPurchasePrice ?? 0)}</td>
              <td class="text-danger">${formatCurrency(previousWeekStats.totalPurchasePrice ?? 0)}</td>
            </tr>
            <tr>
              <td>Net Sales</td>
              <td class="text-success">${formatCurrency(totalWeekProfit)}</td>
              <td class="text-success">${formatCurrency(totalPrevWeekProfit)}</td>
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
              <td>{previousMonthStats.itemCount}</td>
              <td>{last6MonthStats.itemCount}</td>
            </tr>
            <tr>
              <td>Gross Sales</td>
              <td class="text-success">${formatCurrency(totalPreviousMonthProfit)}</td>
              <td class="text-success">${formatCurrency(totalLast6MonthProfit)}</td>
            </tr>
            <tr>
              <td>Total Fees</td>
              <td class="text-danger">${formatCurrency(previousMonthStats.totalFees ?? 0)}</td>
              <td class="text-danger">${formatCurrency(last6MonthStats.totalFees ?? 0)}</td>
            </tr>
            <tr>
              <td>Shipping</td>
              {#if (previousMonthStats.finalShippingCost ?? 0) > 0}
                <td class="text-success">${formatCurrency(previousMonthStats.finalShippingCost ?? 0)}</td>
              {:else}
                <td class="text-danger">${formatCurrency(Math.abs(previousMonthStats.finalShippingCost ?? 0).toFixed(2))}</td>
              {/if}
              {#if (last6MonthStats.finalShippingCost ?? 0) > 0}
                <td class="text-success">${formatCurrency(last6MonthStats.finalShippingCost ?? 0)}</td>
              {:else}
                <td class="text-danger">${formatCurrency(Math.abs(last6MonthStats.finalShippingCost ?? 0).toFixed(2))}</td>
              {/if}
            </tr>
            <tr>
              <td>COG</td>
              <td class="text-danger">${formatCurrency(previousMonthStats.totalPurchasePrice ?? 0)}</td>
              <td class="text-danger">${formatCurrency(last6MonthStats.totalPurchasePrice ?? 0)}</td>
            </tr>
            <tr>
              <td>Net Sales</td>
              <td class="text-success">${formatCurrency(totalPreviousMonthProfit)}</td>
              <td class="text-success">${formatCurrency(totalLast6MonthProfit)}</td>
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
