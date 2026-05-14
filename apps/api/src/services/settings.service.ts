import { inArray } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { appSettings } from '../db/schema.js';
import type { GoogleAuthStatus } from '../types.js';

const GOOGLE_CLIENT_ID = 'google_client_id';
const GOOGLE_CLIENT_SECRET = 'google_client_secret';
const GOOGLE_ALLOWED_DOMAINS = 'google_allowed_domains';

export async function getGoogleAuthStatus(db: Db): Promise<GoogleAuthStatus> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_ALLOWED_DOMAINS,
    ]));

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    configured: byKey.has(GOOGLE_CLIENT_ID) && byKey.has(GOOGLE_CLIENT_SECRET),
    allowedDomains: parseDomains(byKey.get(GOOGLE_ALLOWED_DOMAINS) ?? null),
  };
}

function parseDomains(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((d): d is string => typeof d === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function putGoogleAuthCredentials(
  db: Db,
  input: { clientId: string; clientSecret: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values({ key: GOOGLE_CLIENT_ID, value: input.clientId })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: input.clientId, updatedAt: new Date() },
      });
    await tx
      .insert(appSettings)
      .values({ key: GOOGLE_CLIENT_SECRET, value: input.clientSecret })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: input.clientSecret, updatedAt: new Date() },
      });
  });
}

export async function deleteGoogleAuthCredentials(db: Db): Promise<void> {
  await db
    .delete(appSettings)
    .where(inArray(appSettings.key, [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET]));
}

export async function putGoogleAuthAllowedDomains(
  db: Db,
  input: { allowedDomains: string[] },
): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: GOOGLE_ALLOWED_DOMAINS,
      value: JSON.stringify(input.allowedDomains),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: JSON.stringify(input.allowedDomains),
        updatedAt: new Date(),
      },
    });
}
