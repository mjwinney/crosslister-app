import fetch from 'node-fetch'; // Ensure you have node-fetch installed
import { StatusCodes } from '$lib/server/DatabaseUtils';
import { json } from '@sveltejs/kit';

// Register the user with platform
export async function POST({ request }) {
    // Should get the username and password
    // const { username, password } = await request.json();
    
    // console.log(`api/register/+server.js: POST ${username} ${password}`);
    // const success = await registerUser(username, password);

    // if (success === StatusCodes.OK) {
    //     return json({ message: 'Registration Success', code: success}, { status: 201 });
    // } else if (success === StatusCodes.RegisteredUserAlreadyExists) {
    //     return json({ message: 'User already exists', code: success}, { status: 409 });
    // } else {
    //     return json({ message: 'Failed to register user', code: success}, { status: 500 });
    // }
}


