import { auth } from "$lib/auth"; // path to your auth file
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
import { redirect } from "@sveltejs/kit";
import { getEbayTokensFromDB } from "$lib/server/DatabaseUtils";
import { refreshEbayToken } from "$lib/server/ebayUtils";
 

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
    }
    else if (status.status === 'expired') {
      console.log("eBay token is expired or about to expire:", status.data.accessToken, status.data.refreshToken);
      // Here you might want to trigger a token refresh process
      event.locals.ebayAccessToken = status.data.accessToken;
      event.locals.ebayRefreshToken = status.data.refreshToken;
      await refreshEbayToken(event.locals);
    }
    else if (status.status === 'success') {
      // console.log("ebayAccessToken:", status.data.accessToken);
      // console.log("ebayRefreshToken:", status.data.refreshToken);
      // Determine if the tokens are close to expiration and refresh if necessary
      event.locals.ebayAccessToken = status.data.accessToken;
      event.locals.ebayRefreshToken = status.data.refreshToken;
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
    "/auth/poshmark-sold-items",
    "/auth/poshmark-cross-list"
  ];

  // Check if the current route is protected and the user is not authenticated
  if (protectedRoutes.includes(event.url.pathname) && !event.locals.session) {
    console.log(`Unauthorized access attempt to ${event.url.pathname}, redirecting to /homepage`);
    throw redirect(302, "/homepage"); // Redirect to your home page
  }

  return svelteKitHandler({ event, resolve, auth, building });
}
