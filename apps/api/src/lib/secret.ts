import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { appSettings } from '../db/schema.js';

export const BETTER_AUTH_SECRET_KEY = 'better_auth_secret';
const MIN_SECRET_LENGTH = 32;

function generateSecret(): string {
	return randomBytes(32).toString('base64url');
}

export async function getBetterAuthSecret(db: Db): Promise<string> {
	const fromEnv = process.env.BETTER_AUTH_SECRET;
	if (fromEnv !== undefined && fromEnv !== '') {
		if (fromEnv.length < MIN_SECRET_LENGTH) {
			throw new Error(
				`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${fromEnv.length}). ` +
					`Generate one with: openssl rand -hex 32`
			);
		}
		return fromEnv;
	}

	const candidate = generateSecret();
	const inserted = await db
		.insert(appSettings)
		.values({ key: BETTER_AUTH_SECRET_KEY, value: candidate })
		.onConflictDoNothing({ target: appSettings.key })
		.returning({ value: appSettings.value });

	if (inserted.length > 0 && inserted[0]?.value) {
		return inserted[0].value;
	}

	const existing = await db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, BETTER_AUTH_SECRET_KEY))
		.limit(1);

	if (existing.length === 0 || !existing[0]?.value) {
		throw new Error(
			'Failed to load or create BETTER_AUTH_SECRET in app_settings (insert no-op but row missing). ' +
				'This indicates DB corruption or a write that was rolled back.'
		);
	}
	return existing[0].value;
}
