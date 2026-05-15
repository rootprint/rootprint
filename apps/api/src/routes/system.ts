import { Hono } from 'hono';
import { sql } from 'drizzle-orm';

import { config } from '../config.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import type { AppEnv } from '../env.js';
import type { ComponentStatus, SystemInfo } from '../types.js';

const PROBE_TIMEOUT_MS = 1000;

// drizzle and quickwit-js don't accept AbortSignal, so the inner promise keeps
// running after the race rejects. Acceptable for a low-frequency probe.
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('probe timeout')), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probePostgres(): Promise<ComponentStatus> {
  try {
    await withTimeout(db.execute(sql`SELECT 1`), PROBE_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'down';
  }
}

async function probeQuickwit(): Promise<ComponentStatus> {
  try {
    const live = await withTimeout(quickwit.isLive(), PROBE_TIMEOUT_MS);
    return live ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

export const systemRouter = new Hono<AppEnv>().get('/', async (c) => {
  const [postgres, qw] = await Promise.all([probePostgres(), probeQuickwit()]);
  const body: SystemInfo = {
    mode: 'self-hosted',
    build: config.build,
    components: {
      api: 'ok',
      postgres,
      quickwit: qw,
    },
    startedAt: config.startedAt,
  };
  return c.json(body);
});
