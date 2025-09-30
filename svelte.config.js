// Use the Vercel adapter for deployments on Vercel. Locally you can still run
// with adapter-node if you prefer; for Vercel deployments install
// `@sveltejs/adapter-vercel` and replace the import below.
// import adapter from '@sveltejs/adapter-node';
// import adapter from '@sveltejs/adapter-auto';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use the Vercel adapter so SvelteKit emits the correct .vercel/output
		// structure Vercel expects.
		adapter: adapter({
			runtime: 'nodejs20.x',
			external: ['supports-color', 'google-spreadsheet', 'googleapis']
		}),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '' : ''
		}
	}
};

export default config;
