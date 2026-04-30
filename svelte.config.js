import bunAdapter from 'svelte-adapter-bun';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: bunAdapter(),
		experimental: {
			remoteFunctions: true
		},
		csp: {
			mode: 'auto',
			directives: {
				'script-src': ['self']
			}
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
