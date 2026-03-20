import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';

let mockEnv: Record<string, string> = {};

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

async function importConfig() {
	vi.resetModules();
	vi.mock('$env/dynamic/private', () => ({
		get env() {
			return mockEnv;
		}
	}));
	const mod = await import('../../src/lib/server/config');
	return mod;
}

const TEST_DATA_DIR = './data/test-config';
const TEST_DB_PATH = `${TEST_DATA_DIR}/logwiz.db`;

describe('config', () => {
	beforeEach(() => {
		mockEnv = {};
		mkdirSync(TEST_DATA_DIR, { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_DATA_DIR, { recursive: true, force: true });
	});

	describe('buildConfig', () => {
		it('throws listing all missing required vars', async () => {
			const { buildConfig } = await importConfig();
			expect(() => buildConfig()).toThrow('LOGWIZ_QUICKWIT_URL');
			expect(() => buildConfig()).toThrow('ORIGIN');
		});

		it('throws when only some required vars are missing', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280'
			};
			const { buildConfig } = await importConfig();
			expect(() => buildConfig()).toThrow('ORIGIN');
		});

		it('auto-generates secret on first run', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.secret).toBeTruthy();
			expect(cfg.secret.length).toBe(64); // 32 bytes hex
			expect(existsSync(resolve(TEST_DATA_DIR, '.secret'))).toBe(true);
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Generated auth secret'));
			warnSpy.mockRestore();
		});

		it('reads persisted secret on subsequent runs', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { buildConfig: buildFirst } = await importConfig();
			const first = buildFirst();

			const { buildConfig: buildSecond } = await importConfig();
			const second = buildSecond();

			expect(second.secret).toBe(first.secret);
			warnSpy.mockRestore();
		});

		it('builds config with all required vars and defaults', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.quickwitUrl).toBe('http://localhost:7280');
			expect(cfg.secret).toBeTruthy();
			expect(cfg.origin).toBe('http://localhost:5173');
			expect(cfg.databasePath).toBe(TEST_DB_PATH);
			expect(cfg.adminEmail).toBe('logwiz@logwiz.local');
			expect(cfg.adminUsername).toBe('logwiz');
			expect(cfg.adminPassword).toBeTruthy();
			expect(cfg.inviteExpiryHours).toBe(48);
			expect(cfg.rateLimitWindow).toBe(60);
			expect(cfg.rateLimitMax).toBe(100);
			expect(cfg.signinRateLimitMax).toBe(5);
			warnSpy.mockRestore();
		});

		it('uses optional env vars when provided', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH,
				LOGWIZ_ADMIN_EMAIL: 'admin@example.com',
				LOGWIZ_ADMIN_USERNAME: 'myadmin',
				LOGWIZ_ADMIN_PASSWORD: 'securepass',
				LOGWIZ_INVITE_EXPIRY_HOURS: '72',
				LOGWIZ_RATE_LIMIT_WINDOW: '120',
				LOGWIZ_RATE_LIMIT_MAX: '200',
				LOGWIZ_SIGNIN_RATE_LIMIT_MAX: '3'
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.databasePath).toBe(TEST_DB_PATH);
			expect(cfg.adminEmail).toBe('admin@example.com');
			expect(cfg.adminUsername).toBe('myadmin');
			expect(cfg.adminPassword).toBe('securepass');
			expect(cfg.inviteExpiryHours).toBe(72);
			expect(cfg.rateLimitWindow).toBe(120);
			expect(cfg.rateLimitMax).toBe(200);
			expect(cfg.signinRateLimitMax).toBe(3);
			warnSpy.mockRestore();
		});

		it('falls back to old env var names with deprecation', async () => {
			mockEnv = {
				QUICKWIT_URL: 'http://old:7280',
				LOGWIZ_ORIGIN: 'http://old:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.quickwitUrl).toBe('http://old:7280');
			expect(cfg.origin).toBe('http://old:5173');
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED'));
			warnSpy.mockRestore();
		});

		it('returns a frozen object', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(() => {
				(cfg as unknown as Record<string, unknown>).quickwitUrl = 'changed';
			}).toThrow();
			warnSpy.mockRestore();
		});

		it('ignores non-numeric values for numeric fields and uses defaults', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH,
				LOGWIZ_INVITE_EXPIRY_HOURS: 'notanumber'
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.inviteExpiryHours).toBe(48);
			warnSpy.mockRestore();
		});
	});
});
