<script lang="ts">
	import { goto, invalidate } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";

  // show overlay while a client-side navigation / load is in progress
	let isLoading = $state(false);

  onMount( async () => {
      const session = await authClient.getSession();
      // console.log(`Dashboard page load function: session=${JSON.stringify(session)}`);
      if (!session || !session?.data) {
          goto('/');
      }

      // force reload whenever you enter the page
      invalidate('app:poshmark-dashboard');

      window.addEventListener("message", handlePoshmarkSoldItemsResponse);

      // Get the sold items data for the dashboard.
      sendPoshmarkSoldItemsRequest();
  });

	let { data } = $props();
	const daysToGoBack = $derived(data?.post?.daysToGoBack ?? 90);

  console.log(`Dashboard page load function: data=${JSON.stringify(data)}`);

	function sendPoshmarkSoldItemsRequest() {
    // Send to server or extension to fetch sold items
    // console.log("sendPoshmarkSoldItemsRequest called");

		isLoading = true; // Show loading spinner while fetching data

		// This is going to go to the chrome extension content script,
		// which will then forward to the background script,
		// which will call our server API route.
		// We have to do it this way because the content script is the only 
		// part of our code that can access the cookies/local storage of the 
		// Poshmark web app to get the auth token needed to call Poshmark's API.

		// We need to get see how many days to go back in the poshmark sold items request.
		// To do this we can call database method getPoshmarkDaysInPastToScrape which will
		// check our database for the most recent sold item and calculate how many days back we need to go to get new items.
    window.postMessage({ type: "IMPORT_POSHMARK_SOLD_ITEMS", daysBack: daysToGoBack }, "*");
  }

  async function handlePoshmarkSoldItemsResponse(event: MessageEvent) {
		console.log("handlePoshmarkSoldItemsResponse() called:" + JSON.stringify(event));

    if (event.data?.type === "POSHMARK_SOLD_DATA") {
        console.log("Received POSHMARK_SOLD_DATA from Poshmark data:", event.data);
        // Handle response as needed
        // let poshMarkSoldItemsData = JSON.stringify(event.data.data);

			// Send the data to the page.server.ts so it can be saved to the database.
			const formData = new FormData();
			formData.append('data', JSON.stringify(event.data.data));

			// const res = await fetch('/auth/poshmark-sold-items/save-poshmark-sold-items', {
			// 	method: 'POST',
			// 	body: formData
			// });

			// const data = await res.json();

			// if (!res.ok) {
			// 	console.error('Failed to send sold items to server', JSON.stringify(event.data.data));
			// 	return {
			// 		status: 'error',
			// 		message: data
			// 	};
			// }

			// Action returns the data to be displayed in the UI
			// so save it to a variable that the UI can access.
			// const json = await res.json();
			// console.log('Imported sold items, server response:', json);

			// Save the data so it can be displayed in the UI. 
			// We have to do it this way because the load function only runs on page load,
			// and we want to update the UI immediately after importing without requiring a page refresh.
			// dataItems = json;
            // console.log("POSHMARK_SOLD_DATA EXIT");

			// Force the page to reload so it will re-run the load function and get the new data 
			// from the database, which was just updated with the imported sold items.
			// await handlePageChange(1);
		}
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

	// let { data } = $props();

  // const totalWeekProfit = data.post.weekStats.data.grossSales - data.post.weekStats.data.totalFees - data.post.weekStats.data.totalPurchasePrice + data.post.weekStats.data.finalShippingCost;
  // const totalPrevWeekProfit = data.post.previousWeekStats.data.grossSales - data.post.previousWeekStats.data.totalFees - data.post.previousWeekStats.data.totalPurchasePrice + data.post.previousWeekStats.data.finalShippingCost;
  // const totalWeekROI = calculateROI(totalWeekProfit, data.post.weekStats.data.totalPurchasePrice + data.post.weekStats.data.totalFees - data.post.weekStats.data.finalShippingCost);
  // const totalPrevWeekROI = calculateROI(totalPrevWeekProfit, data.post.previousWeekStats.data.totalPurchasePrice + data.post.previousWeekStats.data.totalFees - data.post.previousWeekStats.data.finalShippingCost);

  // const totalPreviousMonthProfit = data.post.previousMonthStats.data.grossSales - data.post.previousMonthStats.data.totalFees - data.post.previousMonthStats.data.totalPurchasePrice + data.post.previousMonthStats.data.finalShippingCost;
  // const totalLast6MonthProfit = data.post.last6MonthStats.data.grossSales - data.post.last6MonthStats.data.totalFees - data.post.last6MonthStats.data.totalPurchasePrice + data.post.last6MonthStats.data.finalShippingCost;
  // const totalPreviousMonthROI = calculateROI(totalPreviousMonthProfit, data.post.previousMonthStats.data.totalPurchasePrice + data.post.previousMonthStats.data.totalFees - data.post.previousMonthStats.data.finalShippingCost);
  // const totalLast6MonthROI = calculateROI(totalLast6MonthProfit, data.post.last6MonthStats.data.totalPurchasePrice + data.post.last6MonthStats.data.totalFees - data.post.last6MonthStats.data.finalShippingCost);

</script>

<h1>Dashboard</h1>

<div class="mx-auto w-full max-w-6xl px-4 py-4">
  <div class="dashboard-grid">
    <div class="dashboard-card">
        <div class="dashboard-card-header">
            <h4>Weekly Sales Overview</h4>
        </div>
      <div class="dashboard-card-body">
        <h4>Sales Metrics</h4>
      </div>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-header">
        <h4>Monthly Sales Overview</h4>
        </div>
      <div class="dashboard-card-body">
      <h4>Sales Metrics</h4>
      </div>
    </div>
  </div>
</div>
