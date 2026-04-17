import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { env } from '$env/dynamic/private';
import { randomHex } from '$lib/utils/crypto';

const warnings: string[] = [];

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
	warnings.push(`${name} = ${defaultValue}`);
	return defaultValue;
}

function envInt(name: string, defaultValue: number): number {
	const raw = env[name];
	if (!raw) {
		warnings.push(`${name} = ${defaultValue}`);
		return defaultValue;
	}
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed)) {
		warnings.push(`${name} = ${defaultValue} (ignored invalid value "${raw}")`);
		return defaultValue;
	}
	return parsed;
}

function resolveSecret(dataDir: string): string {
	const envSecret = env.LOGWIZ_AUTH_SECRET;
	if (envSecret) {
		if (envSecret.length >= 32) return envSecret;
		console.warn('[logwiz] LOGWIZ_AUTH_SECRET is set but shorter than 32 characters, ignoring');
	}

	const secretPath = resolve(dataDir, '.secret');
	if (existsSync(secretPath)) {
		const existing = readFileSync(secretPath, 'utf-8').trim();
		if (existing.length >= 32) return existing;
	}
	const generated = randomHex(32);
	mkdirSync(dataDir, { recursive: true });
	writeFileSync(secretPath, generated, { mode: 0o600 });
	console.warn(`[logwiz] Generated auth secret at ${secretPath}`);
	return generated;
}

function loadConfig() {
	const quickwitUrl = envRequired('LOGWIZ_QUICKWIT_URL');
	const origin = envOptional('ORIGIN');
	const databasePath = envString('LOGWIZ_DATABASE_PATH', './data/logwiz.db');
	const inviteExpiryHours = envInt('LOGWIZ_INVITE_EXPIRY_HOURS', 48);
	const rateLimitWindow = envInt('LOGWIZ_RATE_LIMIT_WINDOW', 60);
	const rateLimitMax = envInt('LOGWIZ_RATE_LIMIT_MAX', 100);
	const signinRateLimitMax = envInt('LOGWIZ_SIGNIN_RATE_LIMIT_MAX', 5);

	const secret = resolveSecret(dirname(resolve(databasePath)));
	if (!env.LOGWIZ_AUTH_SECRET) {
		warnings.push('LOGWIZ_AUTH_SECRET = (file-generated)');
	}

	if (warnings.length > 0) {
		console.warn(`[logwiz] Using defaults for:\n${warnings.map((w) => `  - ${w}`).join('\n')}`);
	}

	return Object.freeze({
		quickwitUrl,
		secret,
		origin,
		databasePath,
		inviteExpiryHours,
		rateLimitWindow,
		rateLimitMax,
		signinRateLimitMax
	});
}

export type Config = ReturnType<typeof loadConfig>;

export const config = loadConfig();
