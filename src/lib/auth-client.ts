// import { env } from '$env/dynamic/private';
// import { createAuthClient } from "better-auth/svelte"
// export const authClient = createAuthClient({
//     /** The base URL of the server (optional if you're using the same domain) */
//     baseURL: env.BETTER_AUTH_URL
// })

// export const { signIn, signUp, useSession } = createAuthClient() // Another example

import { createAuthClient } from "better-auth/svelte"; // make sure to import from better-auth/svelte
 
export const authClient = createAuthClient({
  // you can pass client configuration here
});