import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	},
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['lcov', 'text'],
			reportsDirectory: './coverage'
		}
	}
});
