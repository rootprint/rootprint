import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
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
import { tokensRouter } from './routes/tokens.js';
import { usersRouter } from './routes/users.js';
import { HttpError } from './utils/http-error.js';
import { Code, otlpError, otlpErrorFromHttpError } from './utils/otlp-response.js';

function withAuth<E extends AppEnv>(router: Hono<E>): Hono<AppEnv> {
  const wrapped = new Hono<AppEnv>();
  wrapped.use('*', requireUser);
  wrapped.route('/', router as unknown as Hono<AppEnv>);
  return wrapped;
}

export const app = new Hono<AppEnv>();

app.use('*', requestContext);
app.use('*', cors({ origin: config.frontendUrl, credentials: true }));

app.onError((err, c) => {
  const requestId = c.get('requestId');
  // oxlint-disable-next-line no-shadow
  const logger = c.get('logger');

  if (c.req.path.startsWith('/v1/')) {
    if (err instanceof HttpError) return otlpErrorFromHttpError(err);
    logger.error({ err }, 'OTLP route unexpected error');
    return otlpError(503, Code.UNAVAILABLE, 'Upstream unavailable', 5);
  }

  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, 'server error');
      return c.json(
        { error: { code: err.code, message: 'Internal server error', statusCode: err.statusCode, requestId } },
        err.statusCode as 500 | 502 | 503,
      );
    }
    logger.debug(
      { err: err.message, code: err.code, statusCode: err.statusCode },
      'client error',
    );
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          statusCode: err.statusCode,
          requestId,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 415 | 422 | 429,
    );
  }

  if (err instanceof ValiError) {
    const details = err.issues.map((issue) => ({
      path:
        Array.isArray(issue.path) && issue.path.length > 0
          ? issue.path.map((p: { key: unknown }) => String(p.key)).join('.')
          : '(root)',
      message: issue.message,
    }));
    logger.debug({ err: err.message }, 'validation error');
    return c.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', statusCode: 400, requestId, details } },
      400,
    );
  }

  if (err instanceof SyntaxError) {
    logger.debug({ err: err.message }, 'invalid json body');
    return c.json(
      { error: { code: 'INVALID_JSON', message: 'Invalid JSON body', statusCode: 400, requestId } },
      400,
    );
  }

  logger.error({ err }, 'unhandled error');
  return c.json(
    { error: { code: 'INTERNAL', message: 'Internal server error', statusCode: 500, requestId } },
    500,
  );
});

app.notFound((c) => {
  if (c.req.path.startsWith('/v1/')) {
    return otlpError(404, Code.NOT_FOUND, 'Route not found');
  }
  const requestId = c.get('requestId');
  return c.json(
    { error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found', statusCode: 404, requestId } },
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
