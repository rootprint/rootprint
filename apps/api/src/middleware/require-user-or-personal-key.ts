import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { ApiKey } from '@better-auth/api-key';

import { user } from '../db/auth.schema.js';
import type { AuthedEnv } from '../env.js';
import { auth, type Session } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import type { Scope } from '../types.js';
import { extractBearerToken } from '../utils/bearer.js';
import { forbidden, internal, unauthorized } from '../utils/http-error.js';
import { requireUser } from './require-user.js';

type VerifyApiKeyFn = (opts: {
	body: { key: string; permissions?: Record<string, string[]> };
}) => Promise<
	| { valid: boolean; error: { message: string | undefined; code: string }; key: null }
	| { valid: boolean; error: null; key: Omit<ApiKey, 'key'> | null }
>;
function getVerifyApiKey(): VerifyApiKeyFn {
	return (auth().api as unknown as { verifyApiKey: VerifyApiKeyFn }).verifyApiKey;
}

export function requireUserOrPersonalKey(required: Scope): MiddlewareHandler<AuthedEnv> {
	return async (c, next) => {
		const bearer = extractBearerToken(c.req.header('authorization'));
		if (!bearer) {
			return (requireUser as MiddlewareHandler<AuthedEnv>)(c, next);
		}

		let result: Awaited<ReturnType<VerifyApiKeyFn>>;
		try {
			result = await getVerifyApiKey()({
				body: { key: bearer, permissions: required }
			});
		} catch (err) {
			logger.error({ err, requestId: c.get('requestId') }, 'personal api key verification failed');
			throw internal('API key verification failed');
		}

		if (!result.valid || !result.key) {
			if (result.error?.code === 'KEY_DISABLED' || result.error?.code === 'KEY_NOT_FOUND') {
				throw forbidden('API key is not allowed', 'PERSONAL_KEY_FORBIDDEN');
			}
			throw unauthorized('Invalid API key', 'PERSONAL_KEY_INVALID');
		}

		const [owner] = await db
			.select()
			.from(user)
			.where(eq(user.id, result.key.referenceId))
			.limit(1);
		if (!owner) throw unauthorized('Invalid API key', 'PERSONAL_KEY_INVALID');
		if (owner.banned) throw forbidden('API key owner is banned', 'PERSONAL_KEY_FORBIDDEN');

		const session: NonNullable<Session> = {
			session: {
				id: `apikey:${result.key.id}`,
				token: '',
				userId: owner.id,
				createdAt: result.key.createdAt,
				updatedAt: result.key.updatedAt,
				expiresAt: new Date(Date.now() + 60_000),
				ipAddress: null,
				userAgent: 'personal-api-key'
			},
			user: {
				id: owner.id,
				name: owner.name,
				email: owner.email,
				emailVerified: owner.emailVerified,
				image: owner.image,
				createdAt: owner.createdAt,
				updatedAt: owner.updatedAt,
				role: owner.role ?? undefined,
				banned: owner.banned ?? undefined
			} as NonNullable<Session>['user']
		};
		(session.user as Record<string, unknown>)['lastActive'] = owner.lastActive;
		c.set('session', session);
		c.set('apiKeyActor', { keyId: result.key.id });
		await next();
	};
}
