import { env } from '$env/dynamic/private';
import { randomUUID } from 'crypto';

export interface Config {
	// Required
	quickwitUrl: string;
	secret: string;
	origin: string;
	// Optional with defaults
	databasePath: string;
	adminEmail: string;
	adminUsername: string;
	adminPassword: string;
	inviteExpiryHours: number;
	rateLimitWindow: number;
	rateLimitMax: number;
	signinRateLimitMax: number;
}

function readEnv(newName: string, oldName?: string): string | undefined {
	const value = env[newName];
	if (value) return value;

	if (oldName && env[oldName]) {
		console.warn(
			`[logwiz] DEPRECATED: ${oldName} will be removed in a future version. Use ${newName} instead.`
		);
		return env[oldName];
	}

	return undefined;
}

function parseIntWithDefault(value: string | undefined, defaultValue: number): number {
	if (!value) return defaultValue;
	const parsed = parseInt(value, 10);
	if (isNaN(parsed)) return defaultValue;
	return parsed;
}

let _config: Config | null = null;
let _generatedPassword: string | null = null;

export function buildConfig(): Config {
	const quickwitUrl = readEnv('LOGWIZ_QUICKWIT_URL', 'QUICKWIT_URL');
	const secret = readEnv('LOGWIZ_SECRET', 'BETTER_AUTH_SECRET');
	const origin = readEnv('LOGWIZ_ORIGIN', 'ORIGIN');

	// Validate required vars — collect all errors
	const missing: string[] = [];
	if (!quickwitUrl) missing.push('LOGWIZ_QUICKWIT_URL');
	if (!secret) missing.push('LOGWIZ_SECRET');
	if (!origin) missing.push('LOGWIZ_ORIGIN');

	if (missing.length > 0) {
		throw new Error(
			`[logwiz] Missing required environment variables:\n` +
				missing.map((v) => `  - ${v}`).join('\n')
		);
	}

	// Validate secret length
	if (secret!.length < 32) {
		throw new Error(
			`[logwiz] LOGWIZ_SECRET must be at least 32 characters (got ${secret!.length}).`
		);
	}

	// Optional vars with defaults
	const databasePath = readEnv('LOGWIZ_DATABASE_PATH') ?? './data/logwiz.db';
	const adminEmail = readEnv('LOGWIZ_ADMIN_EMAIL') ?? 'logwiz@logwiz.local';
	const adminUsername = readEnv('LOGWIZ_ADMIN_USERNAME') ?? 'logwiz';

	const adminPasswordEnv = readEnv('LOGWIZ_ADMIN_PASSWORD');
	let adminPassword: string;
	if (adminPasswordEnv) {
		adminPassword = adminPasswordEnv;
	} else {
		adminPassword = randomUUID();
		_generatedPassword = adminPassword;
	}

	const inviteExpiryHours = parseIntWithDefault(readEnv('LOGWIZ_INVITE_EXPIRY_HOURS'), 48);
	const rateLimitWindow = parseIntWithDefault(readEnv('LOGWIZ_RATE_LIMIT_WINDOW'), 60);
	const rateLimitMax = parseIntWithDefault(readEnv('LOGWIZ_RATE_LIMIT_MAX'), 100);
	const signinRateLimitMax = parseIntWithDefault(readEnv('LOGWIZ_SIGNIN_RATE_LIMIT_MAX'), 5);

	// Warn about optional vars using defaults
	const optionalDefaults: [string, string | number][] = [];
	if (!readEnv('LOGWIZ_DATABASE_PATH'))
		optionalDefaults.push(['LOGWIZ_DATABASE_PATH', databasePath]);
	if (!readEnv('LOGWIZ_ADMIN_EMAIL')) optionalDefaults.push(['LOGWIZ_ADMIN_EMAIL', adminEmail]);
	if (!readEnv('LOGWIZ_ADMIN_USERNAME'))
		optionalDefaults.push(['LOGWIZ_ADMIN_USERNAME', adminUsername]);
	if (!adminPasswordEnv) optionalDefaults.push(['LOGWIZ_ADMIN_PASSWORD', '(generated)']);
	if (!readEnv('LOGWIZ_INVITE_EXPIRY_HOURS'))
		optionalDefaults.push(['LOGWIZ_INVITE_EXPIRY_HOURS', inviteExpiryHours]);
	if (!readEnv('LOGWIZ_RATE_LIMIT_WINDOW'))
		optionalDefaults.push(['LOGWIZ_RATE_LIMIT_WINDOW', rateLimitWindow]);
	if (!readEnv('LOGWIZ_RATE_LIMIT_MAX'))
		optionalDefaults.push(['LOGWIZ_RATE_LIMIT_MAX', rateLimitMax]);
	if (!readEnv('LOGWIZ_SIGNIN_RATE_LIMIT_MAX'))
		optionalDefaults.push(['LOGWIZ_SIGNIN_RATE_LIMIT_MAX', signinRateLimitMax]);

	if (optionalDefaults.length > 0) {
		console.warn(
			`[logwiz] Using defaults for:\n` +
				optionalDefaults.map(([k, v]) => `  - ${k} = ${v}`).join('\n')
		);
	}

	return Object.freeze({
		quickwitUrl: quickwitUrl!,
		secret: secret!,
		origin: origin!,
		databasePath,
		adminEmail,
		adminUsername,
		adminPassword,
		inviteExpiryHours,
		rateLimitWindow,
		rateLimitMax,
		signinRateLimitMax
	});
}

export function getGeneratedPassword(): string | null {
	return _generatedPassword;
}

export function validateConfig(): Config {
	if (!_config) {
		_config = buildConfig();
	}
	return _config;
}

export const config = new Proxy({} as Config, {
	get(_, prop: string) {
		if (!_config) {
			_config = buildConfig();
		}
		return _config[prop as keyof Config];
	}
});
