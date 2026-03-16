import { describe, expect, it, vi, beforeEach } from 'vitest';

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

const VALID_SECRET = 'a'.repeat(32);

describe('config', () => {
	beforeEach(() => {
		mockEnv = {};
	});

	describe('buildConfig', () => {
		it('throws listing all missing required vars', async () => {
			const { buildConfig } = await importConfig();
			expect(() => buildConfig()).toThrow('LOGWIZ_QUICKWIT_URL');
			expect(() => buildConfig()).toThrow('LOGWIZ_SECRET');
			expect(() => buildConfig()).toThrow('LOGWIZ_ORIGIN');
		});

		it('throws when only some required vars are missing', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				LOGWIZ_SECRET: VALID_SECRET
			};
			const { buildConfig } = await importConfig();
			expect(() => buildConfig()).toThrow('LOGWIZ_ORIGIN');
		});

		it('throws when secret is shorter than 32 chars', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				LOGWIZ_SECRET: 'tooshort',
				LOGWIZ_ORIGIN: 'http://localhost:5173'
			};
			const { buildConfig } = await importConfig();
			expect(() => buildConfig()).toThrow('at least 32 characters');
		});

		it('builds config with all required vars and defaults', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				LOGWIZ_SECRET: VALID_SECRET,
				LOGWIZ_ORIGIN: 'http://localhost:5173'
			};
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.quickwitUrl).toBe('http://localhost:7280');
			expect(cfg.secret).toBe(VALID_SECRET);
			expect(cfg.origin).toBe('http://localhost:5173');
			expect(cfg.databasePath).toBe('./data/logwiz.db');
			expect(cfg.adminEmail).toBe('logwiz@logwiz.local');
			expect(cfg.adminUsername).toBe('logwiz');
			expect(cfg.adminPassword).toBeTruthy();
			expect(cfg.inviteExpiryHours).toBe(48);
			expect(cfg.rateLimitWindow).toBe(60);
			expect(cfg.rateLimitMax).toBe(100);
			expect(cfg.signinRateLimitMax).toBe(5);
		});

		it('uses optional env vars when provided', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				LOGWIZ_SECRET: VALID_SECRET,
				LOGWIZ_ORIGIN: 'http://localhost:5173',
				LOGWIZ_DATABASE_PATH: '/var/lib/logwiz/db.sqlite',
				LOGWIZ_ADMIN_EMAIL: 'admin@example.com',
				LOGWIZ_ADMIN_USERNAME: 'myadmin',
				LOGWIZ_ADMIN_PASSWORD: 'securepass',
				LOGWIZ_INVITE_EXPIRY_HOURS: '72',
				LOGWIZ_RATE_LIMIT_WINDOW: '120',
				LOGWIZ_RATE_LIMIT_MAX: '200',
				LOGWIZ_SIGNIN_RATE_LIMIT_MAX: '3'
			};
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.databasePath).toBe('/var/lib/logwiz/db.sqlite');
			expect(cfg.adminEmail).toBe('admin@example.com');
			expect(cfg.adminUsername).toBe('myadmin');
			expect(cfg.adminPassword).toBe('securepass');
			expect(cfg.inviteExpiryHours).toBe(72);
			expect(cfg.rateLimitWindow).toBe(120);
			expect(cfg.rateLimitMax).toBe(200);
			expect(cfg.signinRateLimitMax).toBe(3);
		});

		it('falls back to old env var names with deprecation', async () => {
			mockEnv = {
				QUICKWIT_URL: 'http://old:7280',
				BETTER_AUTH_SECRET: VALID_SECRET,
				ORIGIN: 'http://old:5173'
			};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.quickwitUrl).toBe('http://old:7280');
			expect(cfg.secret).toBe(VALID_SECRET);
			expect(cfg.origin).toBe('http://old:5173');
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED'));
			warnSpy.mockRestore();
		});

		it('returns a frozen object', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				LOGWIZ_SECRET: VALID_SECRET,
				LOGWIZ_ORIGIN: 'http://localhost:5173'
			};
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(() => {
				(cfg as Record<string, unknown>).quickwitUrl = 'changed';
			}).toThrow();
		});

		it('ignores non-numeric values for numeric fields and uses defaults', async () => {
			mockEnv = {
				LOGWIZ_QUICKWIT_URL: 'http://localhost:7280',
				LOGWIZ_SECRET: VALID_SECRET,
				LOGWIZ_ORIGIN: 'http://localhost:5173',
				LOGWIZ_INVITE_EXPIRY_HOURS: 'notanumber'
			};
			const { buildConfig } = await importConfig();
			const cfg = buildConfig();
			expect(cfg.inviteExpiryHours).toBe(48);
		});
	});
});
