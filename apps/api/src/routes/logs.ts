import { Hono, type MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import type { AppEnv as BaseEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import {
  canAccessIndex,
  getIndexSettings,
  type FieldConfig,
} from '../services/index.service.js';
import { fieldValues, histogramLogs, searchLogs } from '../services/log.service.js';
import { getIndex } from '../services/quickwit-index.service.js';
import { badRequest, indexAccessError, internal } from '../utils/http-error.js';

type LogsEnv = BaseEnv & { Variables: BaseEnv['Variables'] & { fieldConfig: FieldConfig } };

const IndexIdParams = v.object({ indexId: v.pipe(v.string(), v.minLength(1)) });
const FieldParams = v.object({
  indexId: v.pipe(v.string(), v.minLength(1)),
  field: v.pipe(v.string(), v.minLength(1)),
});

const toNum = v.pipe(
  v.string(),
  v.transform((s) => {
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error('must be a finite number');
    return n;
  }),
);

const SearchQuery = v.object({
  q: v.optional(v.string()),
  limit: v.optional(v.pipe(v.string(), v.transform((s) => {
    const n = parseInt(s, 10);
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error('must be 1–1000');
    return n;
  }))),
  offset: v.optional(v.pipe(v.string(), v.transform((s) => {
    const n = parseInt(s, 10);
    if (!Number.isInteger(n) || n < 0) throw new Error('must be >= 0');
    return n;
  }))),
  startTs: v.optional(toNum),
  endTs: v.optional(toNum),
  sortOrder: v.optional(v.picklist(['asc', 'desc'])),
  countAll: v.optional(v.pipe(v.string(), v.transform((s) => s === 'true'))),
});

const HistogramQuery = v.object({
  q: v.optional(v.string()),
  startTs: v.optional(toNum),
  endTs: v.optional(toNum),
  interval: v.pipe(v.string(), v.minLength(1)),
});

const FieldValuesQuery = v.object({
  q: v.optional(v.string()),
  startTs: v.optional(toNum),
  endTs: v.optional(toNum),
  limit: v.optional(v.pipe(v.string(), v.transform((s) => {
    const n = parseInt(s, 10);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('must be 1–100');
    return n;
  }))),
});

const requireIndexAccess: MiddlewareHandler<LogsEnv> = async (c, next) => {
  const { indexId } = v.parse(IndexIdParams, c.req.param());
  const isAdmin = c.get('session')?.user.role === 'admin';

  const [settings, index] = await Promise.all([
    getIndexSettings(db, indexId),
    getIndex(quickwit, indexId),
  ]);

  if (!canAccessIndex(settings.visibility, isAdmin)) throw indexAccessError(isAdmin, 'denied');
  if (!index) throw indexAccessError(isAdmin, 'missing');
  if (!index.timestampField) throw internal(`Index "${indexId}" has no timestamp_field`);

  c.set('fieldConfig', {
    indexId,
    levelField: settings.levelField,
    timestampField: index.timestampField,
    messageField: settings.messageField,
    tracebackField: settings.tracebackField,
    contextFields: settings.contextFields,
  });
  await next();
};

export const logsRouter = new Hono<LogsEnv>();

logsRouter.get('/:indexId/search', requireIndexAccess, async (c) => {
  const q = v.parse(SearchQuery, c.req.query());
  return c.json(
    await searchLogs(quickwit, c.get('fieldConfig'), {
      query: q.q, limit: q.limit, offset: q.offset, startTs: q.startTs, endTs: q.endTs,
      sortOrder: q.sortOrder, countAll: q.countAll,
    }),
  );
});

logsRouter.get('/:indexId/histogram', requireIndexAccess, async (c) => {
  const { q, startTs, endTs, interval } = v.parse(HistogramQuery, c.req.query());
  if (!/^[1-9]\d*[smhdwMy]$/.test(interval)) {
    throw badRequest('interval must be a positive integer followed by s, m, h, d, w, M, or y');
  }
  return c.json(await histogramLogs(quickwit, c.get('fieldConfig'), { query: q, startTs, endTs, interval }));
});

logsRouter.get('/:indexId/field-values/:field', requireIndexAccess, async (c) => {
  const { field } = v.parse(FieldParams, c.req.param());
  const { q, startTs, endTs, limit } = v.parse(FieldValuesQuery, c.req.query());
  return c.json(await fieldValues(quickwit, c.get('fieldConfig'), field, { query: q, startTs, endTs, limit }));
});
