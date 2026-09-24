// src/routes/your-page/+page.server.ts
import type { Actions } from './$types';
import { authClient } from '../../lib/auth-client';

export const actions = {
	anotherAction: async ({ request }) => {
		console.log('GOT ANOTHERACTION AUTH ACTION');
		const data = await request.formData();
		const email = data.get('email');
		const password = data.get('password');
		console.log('Server received email:', email);
		console.log('Server received password:', password);

		if (email == null || password == null) {
			console.log('Email or password is null');
			return { success: false, error: 'Email or password is null' };
		}

		const { error } = await authClient.signUp.email(
			{
				email: email.toString() || '',
				password: password.toString() || '',
				name: 'MarksName'
			},
			{
				onRequest: () => {
					console.log('onRequest call to authClient.signUp.email:');
				},
				onSuccess: () => {
					console.log('onSuccess call to authClient.signUp.email:');
				},
				onError: (ctx) => {
					console.log('onError call to authClient.signUp.email:');
					console.error(ctx.error.message);
				}
			}
		);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'Registration success' };
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