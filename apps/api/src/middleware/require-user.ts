import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';

import { config } from '../config.js';
import { user } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { auth, type Session } from '../lib/auth.js';
import { db } from '../lib/db.js';
import type { Logger } from '../lib/logger.js';
import { internal, unauthorized } from '../utils/http-error.js';

// Intentionally unbounded; user cardinality is small in practice and pre-existing pattern.
const lastActiveMap = new Map<string, number>();

function bumpLastActive(userId: string, logger: Logger) {
  const now = Date.now();
  const last = lastActiveMap.get(userId) ?? 0;
  if (now - last <= config.lastActiveThrottleMs) return;
  lastActiveMap.set(userId, now);
  db.update(user)
    .set({ lastActive: new Date(now) })
    .where(eq(user.id, userId))
    .catch((err) => logger.warn({ err }, 'failed to update lastActive'));
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  let session;
  try {
    session = await auth.api.getSession({ headers: c.req.raw.headers });
  } catch (err) {
    c.get('logger').error({ err }, 'session validation failed');
    throw internal('Session validation failed');
  }
  if (!session) throw unauthorized('Unauthorized');
  c.set('session', session);
  bumpLastActive(session.user.id, c.get('logger'));
  await next();
};

export function requireSession<E extends AppEnv>(c: Context<E>): NonNullable<Session> {
  const s = c.get('session') as Session | undefined;
  if (!s) throw internal('Session missing — middleware misconfigured');
  return s;
}
