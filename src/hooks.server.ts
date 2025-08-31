import { auth } from "$lib/auth"; // path to your auth file
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
 

export async function handle({ event, resolve }) {
    console.log('hooks.server.ts Handling request...');
  // Fetch current session from Better Auth
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });
  console.log('Session:', session);
 
  // Make session and user available on server
  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
  }
 
  return svelteKitHandler({ event, resolve, auth, building });
}
