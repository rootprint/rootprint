import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	},
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
