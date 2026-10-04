import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

function whatsNew() {
	const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
	const { version } = JSON.parse(read('../../package.json')) as { version: string };
	const release = read('../../CHANGELOG.md')
		.split(/^## /m)
		.find((s) => s.startsWith(`[${version}]`));
	const highlights = release
		?.split(/^### /m)
		.find((s) => s.startsWith('Highlights\n'))
		?.split(/^[-*] /m)
		.slice(1)
		.map((item) =>
			item
				.replace(/\*\*|`/g, '')
				.replace(/\s+/g, ' ')
				.trim()
		);
	return { version, highlights: highlights ?? [] };
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter({ fallback: 'index.html', strict: false })
		})
	],
	define: { WHATS_NEW: JSON.stringify(whatsNew()) },
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:8282',
				changeOrigin: true,
				ws: false
			},
			'/v1': {
				target: 'http://localhost:8282',
				changeOrigin: true,
				ws: false
			}
		}
	}
});
