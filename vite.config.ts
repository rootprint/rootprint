import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig(({ mode }) => ({
	plugins: [tailwindcss(), sveltekit(), ...(mode === 'development' ? [devtoolsJson()] : [])],
	server: {
		watch: {
			ignored: ['**/.quickwit/**']
		}
	}
}));
