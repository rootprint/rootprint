import { eq } from 'drizzle-orm';

import { OAUTH_GRACE_MS, OAUTH_RECHECK_MS } from '../constants.js';
import { session } from '../db/schema.js';
import { userRetainsOAuthAccess } from '../services/auth.service.js';
import { db } from './db.js';
import { logger } from './logger.js';

// Intentionally unbounded, like lastActiveMap in require-user.ts.
const marks = new Map<string, { checkedAt: number; passedAt: number }>();

/**
 * Re-checks OAuth eligibility for a live principal, at most once per
 * OAUTH_RECHECK_MS per user.
 *
 * An indeterminate check (GitHub outage, rate limit, DB error) keeps the last
 * confirmed verdict only within OAUTH_GRACE_MS. GitHub's hourly quota is shared
 * across every token a user owns, so a revoked user could otherwise keep access
 * by exhausting it themselves. `provenAt` is when the caller's credential was
 * issued through the login gate, which counts as a confirmed pass.
 */
export async function retainsOAuthAccess(userId: string, provenAt: Date): Promise<boolean> {
	const now = Date.now();
	const mark = marks.get(userId) ?? { checkedAt: 0, passedAt: 0 };
	const passedAt = Math.max(mark.passedAt, provenAt.getTime());
	const withinGrace = now - passedAt <= OAUTH_GRACE_MS;
	if (now - mark.checkedAt <= OAUTH_RECHECK_MS) return withinGrace;

	// Stamped before awaiting so concurrent requests skip the check instead of starting their own.
	marks.set(userId, { checkedAt: now, passedAt });
	let retained: boolean;
	try {
		retained = await userRetainsOAuthAccess(db, userId);
	} catch (err) {
		logger.error({ err, userId }, 'oauth re-validation unavailable');
		return withinGrace;
	}
	if (retained) {
		marks.set(userId, { checkedAt: now, passedAt: now });
		return true;
	}

	marks.delete(userId);
	await db
		.delete(session)
		.where(eq(session.userId, userId))
		.catch((err: unknown) => {
			logger.error({ err, userId }, 'failed to revoke sessions');
		});
	return false;
}
