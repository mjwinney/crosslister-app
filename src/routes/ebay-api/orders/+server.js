import { json } from '@sveltejs/kit';

export function GET() {
	const number = Math.floor(Math.random() * 6) + 1;

	return new Response(JSON.stringify({ number }), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
}

