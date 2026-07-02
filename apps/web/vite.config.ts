import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
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
