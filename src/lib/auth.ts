import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import client from "./server/db"; // Import the client promise from db.ts

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
});