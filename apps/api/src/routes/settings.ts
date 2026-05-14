import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { reloadAuth } from '../lib/auth.js';
import { requireAdmin } from '../middleware/require-admin.js';
import {
  deleteGoogleAuthCredentials,
  getGoogleAuthStatus,
  putGoogleAuthAllowedDomains,
  putGoogleAuthCredentials,
} from '../services/settings.service.js';

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;

const CredentialsBody = v.object({
  clientId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client ID is required')),
  clientSecret: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client Secret is required')),
});

const AllowedDomainsBody = v.object({
  allowedDomains: v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.trim(),
        v.transform((s) => s.toLowerCase()),
        v.regex(domainRegex, 'Invalid domain format'),
      ),
    ),
    v.minLength(1, 'At least one domain is required'),
    v.transform((arr) => Array.from(new Set(arr))),
  ),
});

export const settingsRouter = new Hono<AppEnv>();

settingsRouter.use('*', requireAdmin);

settingsRouter.get('/google-auth', async (c) =>
  c.json(await getGoogleAuthStatus(db)),
);

settingsRouter.put('/google-auth', async (c) => {
  const body = v.parse(CredentialsBody, await c.req.json());
  await putGoogleAuthCredentials(db, body);
  await reloadAuth();
  return c.body(null, 204);
});

settingsRouter.delete('/google-auth', async (c) => {
  await deleteGoogleAuthCredentials(db);
  await reloadAuth();
  return c.body(null, 204);
});

settingsRouter.put('/google-auth/allowed-domains', async (c) => {
  const body = v.parse(AllowedDomainsBody, await c.req.json());
  await putGoogleAuthAllowedDomains(db, body);
  return c.body(null, 204);
});
