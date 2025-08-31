import { auth } from "$lib/auth"; // path to your auth file
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
import { redirect } from "@sveltejs/kit";
 

export async function handle({ event, resolve }) {
  console.log('hooks.server.ts Handling request...');
  // Fetch current session from Better Auth
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });
  // console.log('Session:', session);
 
  console.log(`hooks.server.ts: event.url.pathname=${event.url.pathname}`);

  // Make session and user available on server
  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
  }
 
  // Define protected routes or patterns
  const protectedRoutes = ["/dashboard"];

  // Check if the current route is protected and the user is not authenticated
  if (protectedRoutes.includes(event.url.pathname) && !event.locals.session) {
    throw redirect(302, "/"); // Redirect to your home page
  }

  return svelteKitHandler({ event, resolve, auth, building });
}
