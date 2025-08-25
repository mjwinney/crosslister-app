// src/routes/your-page/+page.server.ts
import type { Actions } from './$types';
import { authClient } from '../../lib/auth-client'; //import the auth client
import { fail } from 'assert/strict';
import { json } from '@sveltejs/kit';

export const actions = {
	// YOU CANNOT HAVE A DEFAULT ACTION AND ANY OTHER ACTION AT SAME TIME
	// default: async (event) => {
	// 	console.log("GOT DEFAULT AUTH ACTION");
	// 	// TODO log the user in
	// },
	anotherAction: async ({ request }) => {
		console.log("GOT ANOTHERACTION AUTH ACTION");
        const data = await request.formData();
        const email = data.get('email');
        const password = data.get('password');
        // Process data, interact with database, etc.
        console.log('Server received email:', email);
        console.log('Server received password:', password);

		if (email == null || password == null)
		{
			console.log("Email or password is null");
			// return some kind of error to the caller
			return { success: false, error: "Email or password is null" };
		}
		// Now call better auth
		const { error } = await authClient.signUp.email({
        	email: email.toString() || "", // user email address
        	password: password.toString() || "", // user password -> min 8 characters by default
			name: "MarksName"
	        // name: name.toString() || "", // user display name
	        // image, // User image URL (optional)
	        // callbackURL: "/dashboard" // A URL to redirect to after the user verifies their email (optional)
	    }, {
			onRequest: (ctx) => {
				//show loading
		        console.log('onRequest call to authClient.signUp.email:');
			},
			onSuccess: (ctx) => {
				//redirect to the dashboard or sign in page
				console.log('onSuccess call to authClient.signUp.email:');
				// ctx.response = new Response({ body: 'Signup successful', status: 200 });
				return json({ message: 'Registration Success', code: 200}, { status: 201 });
				// return Promise.resolve();
			},
			onError: (ctx) => {
				//show error
				console.log('onError call to authClient.signUp.email:');
				// display the error message
				// return fail(400, { email, message: 'Invalid email address' });
				reject({ status: 'error', message: ctx.error.message });

				// alert(ctx.error.message);
			},
		});
	}
} satisfies Actions;

// export const actions: Actions = {
//     default: async ({ request }) => {
//         const data = await request.formData();
//         const username = data.get('username');
//         // Process data, interact with database, etc.
//         console.log('Server received username:', username);
//         return { success: true };
//     },
//     anotherAction: async ({ request }) => {
//         const data = await request.formData();
//         const item = data.get('item');
//         console.log('Server received item:', item);
//         return { success: true };
//     }
// };