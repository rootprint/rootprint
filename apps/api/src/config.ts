import { config as loadEnv } from 'dotenv';

loadEnv({ path: '../../.env' });

function parseBool(v: string | undefined, fallback: boolean): boolean {
	if (v === undefined) return fallback;
	return v === '1' || v.toLowerCase() === 'true';
}

export const config = {
	host: process.env.HOST ?? '0.0.0.0',
	port: Number.parseInt(process.env.PORT ?? '8282', 10),
	databaseUrl: process.env.DATABASE_URL ?? '',
	quickwitUrl: process.env.QUICKWIT_URL ?? 'http://localhost:7280',
	betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? '',
	betterAuthUrl: process.env.BETTER_AUTH_URL ?? 'http://localhost:8282',
	frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
	inviteExpiryHours: Number.parseInt(process.env.INVITE_EXPIRY_HOURS ?? '48', 10),
	lastActiveThrottleMs: Number.parseInt(process.env.LAST_ACTIVE_THROTTLE_MS ?? '300000', 10),
	serveWeb: parseBool(process.env.LOGWIZ_SERVE_WEB, false),
	webRoot: process.env.LOGWIZ_WEB_ROOT ?? './web'
};
