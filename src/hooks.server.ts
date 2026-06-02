import { auth } from "$lib/auth"; // path to your auth file
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
import { redirect } from "@sveltejs/kit";
import { getEbayTokensFromDB } from "$lib/server/DatabaseUtils";
import { refreshEbayToken, getBrowseApiToken } from "$lib/server/ebayUtils";
 

export async function handle({ event, resolve }) {
  console.log('hooks.server.ts Handling request...');
  // Fetch current session from Better Auth
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });
  // console.log('Session:', session);
 
  console.log(`hooks.server.ts: event.url.pathname=${event.url.pathname}, session=${JSON.stringify(session)}`);

  // Make session and user available on server
  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
    const status = await getEbayTokensFromDB(session.user.id);

    if (status.status === 'error') {
      console.log("Error fetching eBay tokens from DB:", status.message);
      // Token not found or error - set flag and redirect to auth if on protected route
      event.locals.ebayAccessToken = null;
      event.locals.ebayRefreshToken = null;
      
      // Redirect to eBay auth if trying to access a protected eBay route
      const ebayProtectedRoutes = [
        "/auth/active-items",
        "/auth/sold-items",
        "/auth/unsold-items",
        "/auth/dashboard"
      ];
      
      if (ebayProtectedRoutes.includes(event.url.pathname)) {
        console.log("Missing eBay tokens on protected route, redirecting to /ebay-api/auth");
        throw redirect(302, "/ebay-api/auth");
      }
    }
    else if (status.status === 'success') {
      console.log("ebayAccessToken:", status.data.accessToken);
      console.log("ebayRefreshToken:", status.data.refreshToken);
      event.locals.ebayAccessToken = status.data.accessToken;
      event.locals.ebayRefreshToken = status.data.refreshToken;
      event.locals.ebaySellerUsername = status.data.sellerUsername;
      
      // Refresh Sell API token if expired
      if (status.data.refreshTokenStatus === 'expired') {
        console.log("Refresh token is expired or about to expire, refreshing Sell API token");
        await refreshEbayToken(event.locals);
      }
      
      // Refresh Browse token if expired or undefined
      console.log(`Browse token status: ${status.data.browseTokenStatus}`);
      if (status.data.browseTokenStatus === 'expired' || status.data.browseTokenStatus === 'undefined') {
        console.log(`Browse token ${status.data.browseTokenStatus}, fetching fresh token`);
        const browseResult = await getBrowseApiToken(session.user.id);
        if (browseResult.status === 'success') {
          event.locals.ebayBrowseToken = browseResult.data.access_token;
        }
      } else {
        event.locals.ebayBrowseToken = status.data.browseToken;
      }
    }
  }
 
  // Define protected routes or patterns
  const protectedRoutes = [
    "/auth/login",
    "/auth/dashboard",
    "/auth/active-items",
    "/auth/sold-items",
    "/auth/unsold-items",
    "/ebay-api/auth",
    "/auth/ebay-auth-success-callback",
    "/auth/poshmark-sold-items"
  ];

  // Check if the current route is protected and the user is not authenticated
  if (protectedRoutes.includes(event.url.pathname) && !event.locals.session) {
    console.log(`Unauthorized access attempt to ${event.url.pathname}, redirecting to /homepage`);
    throw redirect(302, "/homepage"); // Redirect to your home page
  }

  return svelteKitHandler({ event, resolve, auth, building });
}
