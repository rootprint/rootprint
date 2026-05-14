import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { env } from '$env/dynamic/private';
import { randomHex } from '$lib/utils/crypto';

function envRequired(name: string): string {
	const raw = env[name];
	if (!raw) {
		throw new Error(`[logwiz] Missing required environment variable: ${name}`);
	}
	return raw;
}

function envOptional(name: string): string | undefined {
	return env[name] || undefined;
}

function envString(name: string, defaultValue: string): string {
	const raw = env[name];
	if (raw) return raw;
	return defaultValue;
}

function envInt(name: string, defaultValue: number): number {
	const raw = env[name];
	if (!raw) {
		return defaultValue;
	}
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed)) {
		return defaultValue;
	}
	return parsed;
}

function resolveSecret(dataDir: string, envSecret: string | undefined): string {
	if (envSecret && envSecret.length >= 32) return envSecret;
	const secretPath = resolve(dataDir, '.secret');
	if (existsSync(secretPath)) {
		const existing = readFileSync(secretPath, 'utf-8').trim();
		if (existing.length >= 32) return existing;
	}
	const generated = randomHex(32);
	mkdirSync(dataDir, { recursive: true });
	writeFileSync(secretPath, generated, { mode: 0o600 });
	return generated;
}

function loadConfig() {
	const quickwitUrl = envRequired('LOGWIZ_QUICKWIT_URL');
	const origin = envString('ORIGIN', 'http://localhost:8282');
	const databasePath = envString('LOGWIZ_DATABASE_PATH', './data/logwiz.db');
	const inviteExpiryHours = envInt('LOGWIZ_INVITE_EXPIRY_HOURS', 48);
	const rateLimitWindow = envInt('LOGWIZ_RATE_LIMIT_WINDOW', 60);
	const rateLimitMax = envInt('LOGWIZ_RATE_LIMIT_MAX', 100);
	const signinRateLimitMax = envInt('LOGWIZ_SIGNIN_RATE_LIMIT_MAX', 5);
	const quickwitTimeoutMs = Math.max(1000, envInt('LOGWIZ_QUICKWIT_TIMEOUT_MS', 10000));

	const secret = resolveSecret(dirname(resolve(databasePath)), envOptional('LOGWIZ_AUTH_SECRET'));

	return {
		quickwitUrl,
		secret,
		origin,
		databasePath,
		inviteExpiryHours,
		rateLimitWindow,
		rateLimitMax,
		signinRateLimitMax,
		quickwitTimeoutMs
	};
}

export const config = loadConfig();
