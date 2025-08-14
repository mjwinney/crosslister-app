import fetch from 'node-fetch'; // Ensure you have node-fetch installed
import {    registerUser, StatusCodes } from '$lib/server/DatabaseUtils';

// Register the user with platform
export async function POST({ request }) {
    // Should get the username and password
    const { username, password } = await request.json();
    console.log(`api/register/+server.js: POST ${username} ${password}`);
    const success = await registerUser(username, password);
    if (success === StatusCodes.OK) {
        return new Response('User registered successfully', { status: 201 });
    } else if (success === StatusCodes.RegisteredUserAlreadyExists) {
        return new Response('User already exists', { status: 409 });
    } else {
        return new Response('Failed to register user', { status: 500 });
    }
}


