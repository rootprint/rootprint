import { randomBytes } from 'node:crypto';
import { generateId } from 'better-auth';
import { and, eq } from 'drizzle-orm';

import { config } from '../config.js';
import type { Db } from '../db/index.js';
import { account, inviteToken, user } from '../db/schema.js';
import type { AuthInstance } from '../lib/auth.js';
import { badRequest, conflict } from '../utils/http-error.js';

export async function ensureNoAdmin(db: Db): Promise<void> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, 'admin'))
    .limit(1);

  if (rows.length > 0) {
    throw conflict('Admin already exists');
  }
}

export async function hasCredentialAccount(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
    .limit(1);
  return rows.length > 0;
}

export async function createInviteToken(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.inviteExpiryHours * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.delete(inviteToken).where(eq(inviteToken.userId, userId));
    await tx.insert(inviteToken).values({ userId, token, expiresAt });
  });

  return token;
}

export async function validateInviteToken(
  db: Db,
  token: string,
): Promise<{ userId: string; email: string }> {
  const rows = await db
    .select({
      userId: inviteToken.userId,
      expiresAt: inviteToken.expiresAt,
      email: user.email,
    })
    .from(inviteToken)
    .innerJoin(user, eq(inviteToken.userId, user.id))
    .where(eq(inviteToken.token, token))
    .limit(1);

  if (!rows.length) {
    throw badRequest('Invalid invite token');
  }

  if (rows[0]!.expiresAt < new Date()) {
    throw badRequest('Invite token expired');
  }

  return { userId: rows[0]!.userId, email: rows[0]!.email };
}

export async function setupPassword(
  db: Db,
  auth: AuthInstance,
  token: string,
  password: string,
): Promise<string> {
  const { userId } = await validateInviteToken(db, token);

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
      .limit(1);

    if (existing.length) {
      await tx
        .update(account)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(account.id, existing[0]!.id));
    } else {
      await tx.insert(account).values({
        id: generateId(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await tx
      .update(user)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, userId));

    await tx.delete(inviteToken).where(eq(inviteToken.userId, userId));
  });

  return userId;
}
