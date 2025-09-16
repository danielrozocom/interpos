import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Using adapter-node locally to avoid symlink (EPERM) issues on Windows when
		// @sveltejs/adapter-vercel tries to create symlinks in .vercel/output. For
		// deployments to Vercel restore adapter-vercel in this file.
		adapter: adapter(),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '' : ''
		}
	}
};

export default config;
