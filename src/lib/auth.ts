import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import client from "./server/db"; // Import the client promise from db.ts
import { dev } from "$app/environment";

const db = client.db();

export const auth = betterAuth({
    database: mongodbAdapter(db),
    //...other options
    emailAndPassword: {
        enabled: true,
        autoSignIn: false //defaults to true
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
    },
    baseURL: dev ? "http://localhost:5137" : `https://${process.env.VERCEL_URL}`,
    plugins: [sveltekitCookies(getRequestEvent)], // make sure this is the last plugin in the array
});