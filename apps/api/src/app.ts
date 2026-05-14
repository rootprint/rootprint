import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { QuickwitError } from 'quickwit-js';
import { ValiError } from 'valibot';

import { config } from './config.js';
import type { AppEnv } from './env.js';
import { logger } from './lib/logger.js';
import { requestContext } from './middleware/request-context.js';
import { requireUser } from './middleware/require-user.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { indexesRouter } from './routes/indexes.js';
import { ndjsonRouter } from './routes/ingest/ndjson.js';
import { otlpRouter } from './routes/ingest/otlp.js';
import { logsRouter } from './routes/logs.js';
import { preferencesRouter } from './routes/preferences.js';
import { savedQueriesRouter } from './routes/saved-queries.js';
import { sharesRouter } from './routes/shares.js';
import { tokensRouter } from './routes/tokens.js';
import { usersRouter } from './routes/users.js';
import type { ApiErrorBody, ApiErrorDetail } from './types.js';
import { HttpError } from './utils/http-error.js';
import { Code, otlpError, otlpErrorFromHttpError } from './utils/otlp-response.js';

function withAuth<E extends AppEnv>(router: Hono<E>): Hono<AppEnv> {
  const wrapped = new Hono<AppEnv>();
  wrapped.use('*', requireUser);
  wrapped.route('/', router as unknown as Hono<AppEnv>);
  return wrapped;
}

function errorJson(
  c: Context,
  body: ApiErrorBody['error'],
  status: ContentfulStatusCode,
) {
  return c.json({ error: body }, status);
}

export const app = new Hono<AppEnv>();

app.use('*', requestContext);
app.use('*', cors({ origin: config.frontendUrl, credentials: true }));

app.onError((rawErr, c) => {
  const requestId = c.get('requestId');
  const log = c.get('logger');

  let err: Error = rawErr;
  if (rawErr instanceof QuickwitError) {
    const qwErr: QuickwitError = rawErr;
    err = new HttpError(qwErr.status ?? 500, `QUICKWIT_${qwErr.code}`, qwErr.message);
  }

  if (c.req.path.startsWith('/v1/')) {
    if (err instanceof HttpError) return otlpErrorFromHttpError(err);
    log.error({ err }, 'OTLP route unexpected error');
    return otlpError(503, Code.UNAVAILABLE, 'Upstream unavailable', 5);
  }

  if (err instanceof HttpError) {
    const isServerError = err.statusCode >= 500;
    if (isServerError) {
      log.error({ err }, 'server error');
    } else {
      log.debug(
        { err: err.message, code: err.code, statusCode: err.statusCode },
        'client error',
      );
    }
    return errorJson(
      c,
      {
        code: err.code,
        message: isServerError ? 'Internal server error' : err.message,
        statusCode: err.statusCode,
        requestId,
        ...(!isServerError && err.details ? { details: err.details } : {}),
      },
      err.statusCode as ContentfulStatusCode,
    );
  }

  if (err instanceof ValiError) {
    const details: ApiErrorDetail[] = err.issues.map((issue) => ({
      path:
        Array.isArray(issue.path) && issue.path.length > 0
          ? issue.path.map((p: { key: unknown }) => String(p.key)).join('.')
          : '(root)',
      message: issue.message,
    }));
    log.debug({ err: err.message }, 'validation error');
    return errorJson(
      c,
      { code: 'VALIDATION_FAILED', message: 'Request validation failed', statusCode: 400, requestId, details },
      400,
    );
  }

  if (err instanceof SyntaxError) {
    log.debug({ err: err.message }, 'invalid json body');
    return errorJson(
      c,
      { code: 'INVALID_JSON', message: 'Invalid JSON body', statusCode: 400, requestId },
      400,
    );
  }

  log.error({ err }, 'unhandled error');
  return errorJson(
    c,
    { code: 'INTERNAL', message: 'Internal server error', statusCode: 500, requestId },
    500,
  );
});

app.notFound((c) => {
  if (c.req.path.startsWith('/v1/')) {
    return otlpError(404, Code.NOT_FOUND, 'Route not found');
  }
  return errorJson(
    c,
    { code: 'ROUTE_NOT_FOUND', message: 'Route not found', statusCode: 404, requestId: c.get('requestId') },
    404,
  );
});

export const routes = app
  .route('/api/health', healthRouter)
  .route('/api/auth', authRouter)
  .route('/api/indexes', withAuth(indexesRouter))
  .route('/api/logs', withAuth(logsRouter))
  .route('/api/users', withAuth(usersRouter))
  .route('/api/tokens', withAuth(tokensRouter))
  .route('/api/saved-queries', withAuth(savedQueriesRouter))
  .route('/api/shares', withAuth(sharesRouter))
  .route('/api/preferences', withAuth(preferencesRouter))
  .route('/api/ingest', ndjsonRouter)
  .route('/v1', otlpRouter);

if (config.serveWeb) {
  app.use('/*', serveStatic({ root: config.webRoot }));

  app.get('*', async (c) => {
    const path = c.req.path;
    if (path.startsWith('/api/') || path.startsWith('/v1/')) return c.notFound();
    const html = await Bun.file(`${config.webRoot}/index.html`).text();
    return c.html(html);
  });
}

const server = Bun.serve({
  fetch: app.fetch,
  hostname: config.host,
  port: config.port,
});

logger.info({ host: server.hostname, port: server.port }, 'api listening');
