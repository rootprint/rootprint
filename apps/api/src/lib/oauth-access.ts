import { eq } from 'drizzle-orm';

import { OAUTH_RECHECK_MS } from '../constants.js';
import { session } from '../db/schema.js';
import { userRetainsOAuthAccess } from '../services/auth.service.js';
import { db } from './db.js';
import { logger } from './logger.js';

const checkedAt = new Map<string, number>();

/**
 * Re-checks OAuth eligibility for a live session, throttled per user.
 */
export async function retainsOAuthAccess(userId: string): Promise<boolean> {
	const now = Date.now();
	if (now - (checkedAt.get(userId) ?? 0) <= OAUTH_RECHECK_MS) return true;

	let retained: boolean;
	try {
		retained = await userRetainsOAuthAccess(db, userId, { onCheckError: 'allow' });
	} catch (err) {
		logger.error({ err, userId }, 'oauth re-validation unavailable');
		return true;
	}

	if (retained) {
		checkedAt.set(userId, now);
		return true;
	}

	checkedAt.delete(userId);
	await db
		.delete(session)
		.where(eq(session.userId, userId))
		.catch((err: unknown) => {
			logger.error({ err, userId }, 'failed to revoke sessions');
		});
	return false;
}
