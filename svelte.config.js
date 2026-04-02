import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterNetlify from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: process.env.CF_PAGES ? adapterCloudflare() : adapterNetlify(),
		alias: {
			'$lib': './src/lib'
		}
	}
};

export default config;
