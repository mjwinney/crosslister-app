import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import client from "./server/db"; // Import the client promise from db.ts

const db = client.db();

export const auth = betterAuth({
    database: mongodbAdapter(db),
    //...other options
    session: {
        expiresIn: 15 * 60,   // 15 minutes
        updateAge: 5 * 60     // refresh every 5 minutes if active
    },
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
    plugins: [sveltekitCookies(getRequestEvent)], // make sure this is the last plugin in the array
});