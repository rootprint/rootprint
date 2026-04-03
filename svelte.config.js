import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import bunAdapter from 'svelte-adapter-bun';

function adapter(options = {}) {
	const base = bunAdapter(options);
	return {
		...base,
		async adapt(builder) {
			await base.adapt(builder);
			const handlerPath = join(options.out ?? 'build', 'handler.js');
			const source = readFileSync(handlerPath, 'utf-8');
			const marker = 'get_origin(request.headers)';
			if (!source.includes(marker)) {
				throw new Error(`Adapter patch failed: missing expected marker "${marker}"`);
			}
			writeFileSync(handlerPath, source.replaceAll(marker, 'new URL(request.url).origin'));
		}
	};
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
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
