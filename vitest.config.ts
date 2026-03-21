import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['lcov', 'text'],
			reportsDirectory: './coverage'
		}
	}
});
