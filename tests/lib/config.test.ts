import { existsSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

	describe('loadConfig', () => {
		it('throws listing all missing required vars', async () => {
			let caught: unknown;
			try {
				await importConfig();
			} catch (e) {
				caught = e;
			}
			expect(caught).toBeInstanceOf(Error);
			const message = (caught as Error).message;
			expect(message).toContain('LOGWIZ_QUICKWIT_URL');
			expect(message).not.toContain('ORIGIN');
		});

		it('builds config without ORIGIN set', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { config: cfg } = await importConfig();
			expect(cfg.origin).toBeUndefined();
			warnSpy.mockRestore();
		});

		it('auto-generates secret on first run', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { config: cfg } = await importConfig();
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
			const { config: first } = await importConfig();
			const { config: second } = await importConfig();

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
			const { config: cfg } = await importConfig();
			expect(cfg.quickwitUrl).toBe('http://localhost:7280');
			expect(cfg.secret).toBeTruthy();
			expect(cfg.origin).toBe('http://localhost:5173');
			expect(cfg.databasePath).toBe(TEST_DB_PATH);
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
				LOGWIZ_INVITE_EXPIRY_HOURS: '72',
				LOGWIZ_RATE_LIMIT_WINDOW: '120',
				LOGWIZ_RATE_LIMIT_MAX: '200',
				LOGWIZ_SIGNIN_RATE_LIMIT_MAX: '3'
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { config: cfg } = await importConfig();
			expect(cfg.databasePath).toBe(TEST_DB_PATH);
			expect(cfg.inviteExpiryHours).toBe(72);
			expect(cfg.rateLimitWindow).toBe(120);
			expect(cfg.rateLimitMax).toBe(200);
			expect(cfg.signinRateLimitMax).toBe(3);
			warnSpy.mockRestore();
		});

		it('does not accept legacy QUICKWIT_URL fallback', async () => {
			mockEnv = {
				QUICKWIT_URL: 'http://old:7280',
				LOGWIZ_ORIGIN: 'http://old:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			let caught: unknown;
			try {
				await importConfig();
			} catch (e) {
				caught = e;
			}
			expect(caught).toBeInstanceOf(Error);
			expect((caught as Error).message).toContain('LOGWIZ_QUICKWIT_URL');
			warnSpy.mockRestore();
		});

		it('does not use LOGWIZ_ORIGIN when ORIGIN is missing', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				LOGWIZ_ORIGIN: 'http://old:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { config: cfg } = await importConfig();
			expect(cfg.origin).toBeUndefined();
			warnSpy.mockRestore();
		});

		it('returns a frozen object', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { config: cfg } = await importConfig();
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
			const { config: cfg } = await importConfig();
			expect(cfg.inviteExpiryHours).toBe(48);
			warnSpy.mockRestore();
		});

		it('warns with the invalid value when a numeric env var is non-numeric', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: TEST_DB_PATH,
				LOGWIZ_INVITE_EXPIRY_HOURS: 'notanumber'
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			await importConfig();
			const defaultsWarning = warnSpy.mock.calls
				.map((args) => args.join(' '))
				.find((msg) => msg.includes('Using defaults for'));
			expect(defaultsWarning).toBeDefined();
			expect(defaultsWarning).toContain('LOGWIZ_INVITE_EXPIRY_HOURS = 48');
			expect(defaultsWarning).toContain('ignored invalid value "notanumber"');
			warnSpy.mockRestore();
		});
	});
});
