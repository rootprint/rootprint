import { randomBytes } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';

import type { User, UserRole, UserStatus } from '../types.js';

import { config } from '../config.js';
import type { Db } from '../db/index.js';
import { account, inviteToken, user } from '../db/schema.js';
import type { AuthInstance } from '../lib/auth.js';
import { createInviteToken, hasCredentialAccount } from './auth.service.js';
import { badRequest, fromAuthApiError } from '../utils/http-error.js';

const buildInviteUrl = (token: string) => `${config.frontendUrl}/auth/setup?token=${token}`;

export async function listUsers(db: Db): Promise<User[]> {
  const [users, invites, providerAccounts] = await Promise.all([
    db.select().from(user).orderBy(user.createdAt),
    db.select().from(inviteToken),
    db
      .select({ userId: account.userId, providerId: account.providerId })
      .from(account)
      .where(inArray(account.providerId, ['google', 'credential'])),
  ]);

  const inviteMap = new Map(
    invites.map((inv) => [inv.userId, { url: buildInviteUrl(inv.token), expiresAt: inv.expiresAt }]),
  );

  const googleUserIds = new Set<string>();
  const credentialUserIds = new Set<string>();
  for (const a of providerAccounts) {
    (a.providerId === 'google' ? googleUserIds : credentialUserIds).add(a.userId);
  }

  const now = Date.now();

  return users.map((u) => {
    const invite = inviteMap.get(u.id);
    const isGoogle = googleUserIds.has(u.id);
    const status: UserStatus = isGoogle || !invite
      ? 'active'
      : invite.expiresAt.getTime() < now
        ? 'expired'
        : 'pending';

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role as UserRole | null) ?? null,
      lastActive: u.lastActive,
      status,
      hasCredentialAccount: credentialUserIds.has(u.id),
      inviteUrl: invite?.url ?? null,
      inviteExpiresAt: invite?.expiresAt ?? null,
    };
  });
}

export async function createInvite(
  db: Db,
  auth: AuthInstance,
  data: { email: string; name: string; role: UserRole },
): Promise<{ inviteUrl: string }> {
  let userId: string;
  try {
    const result = await (auth.api as any).createUser({
      body: {
        email: data.email,
        name: data.name,
        password: randomBytes(32).toString('base64url'),
        role: data.role,
      },
    });
    userId = result.user.id;
  } catch (err) {
    throw fromAuthApiError(err, 'Failed to create user');
  }

  const token = await createInviteToken(db, userId);
  return { inviteUrl: buildInviteUrl(token) };
}

export async function resendInvite(db: Db, userId: string): Promise<{ inviteUrl: string }> {
  const hasCred = await hasCredentialAccount(db, userId);
  if (!hasCred) {
    throw badRequest('User has no credential account');
  }
  const token = await createInviteToken(db, userId);
  return { inviteUrl: buildInviteUrl(token) };
}

export async function removeUser(auth: AuthInstance, userId: string): Promise<void> {
  try {
    await (auth.api as any).removeUser({ body: { userId } });
  } catch (err) {
    throw fromAuthApiError(err, 'Failed to remove user');
  }
}

export async function setUserRole(
  auth: AuthInstance,
  adminId: string,
  userId: string,
  role: UserRole,
  headers: Headers,
): Promise<void> {
  if (userId === adminId) {
    throw badRequest('Cannot change your own role');
  }
  try {
    await (auth.api as any).setRole({ body: { userId, role }, headers });
  } catch (err) {
    throw fromAuthApiError(err, 'Failed to change role');
  }
}

export async function resetPassword(
  db: Db,
  auth: AuthInstance,
  adminId: string,
  userId: string,
): Promise<{ inviteUrl: string }> {
  if (userId === adminId) {
    throw badRequest('Cannot reset your own password');
  }
  const hasCred = await hasCredentialAccount(db, userId);
  if (!hasCred) {
    throw badRequest('User has no credential account');
  }

  try {
    await (auth.api as any).revokeUserSessions({ body: { userId } });
  } catch (err) {
    throw fromAuthApiError(err, 'Failed to revoke user sessions');
  }

  await db
    .update(account)
    .set({ password: null, updatedAt: new Date() })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));

  const token = await createInviteToken(db, userId);
  return { inviteUrl: buildInviteUrl(token) };
}
