import { defineConfig } from '@playwright/test';

const API_PORT = 18283;
const IDP_PORT = 18284;

export default defineConfig({
	testDir: './specs',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 30_000,
	use: {
		baseURL: `http://127.0.0.1:${API_PORT}`,
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
	webServer: [
		{
			command: 'bun ../apps/api/tests/helpers/fake-idp-server.ts',
			url: `http://127.0.0.1:${IDP_PORT}/jwks`,
			env: { FAKE_IDP_PORT: String(IDP_PORT) },
			reuseExistingServer: false,
			stdout: 'ignore',
			stderr: 'pipe'
		},
		{
			command: 'bun serve-api.ts',
			url: `http://127.0.0.1:${API_PORT}/api/health`,
			env: { E2E_API_PORT: String(API_PORT) },
			timeout: 60_000,
			reuseExistingServer: false,
			stdout: 'ignore',
			stderr: 'pipe'
		}
	]
});
