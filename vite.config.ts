/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const stub = (file: string) => fileURLToPath(new URL(`./src/test/${file}`, import.meta.url));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		// Stubs keep tests off the real database and secrets in .env.
		alias: {
			'$env/static/private': stub('env-static-private.ts'),
			'$env/dynamic/private': stub('env-dynamic-private.ts')
		},
		testTimeout: 30_000,
		hookTimeout: 120_000
	}
});
