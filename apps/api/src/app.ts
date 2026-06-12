import { Hono, type Context } from 'hono';
import type { Schema } from 'hono/types';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApplyGlobalResponse } from 'hono/client';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuickwitError } from 'quickwit-js';
import { ValiError } from 'valibot';

import { config } from './config.js';
import type { AppEnv, AuthedEnv } from './env.js';
import { initAuth } from './lib/auth.js';
import { connectDb, db, runMigrations } from './lib/db.js';
import { probeQuickwit, quickwit } from './lib/quickwit.js';
import { requestContext } from './middleware/request-context.js';
import { requireUser } from './middleware/require-user.js';
import { adminActivityRouter } from './routes/admin/activity.js';
import { clusterRouter } from './routes/admin/cluster.js';
import { metricsRouter } from './routes/admin/metrics.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { indexesRouter } from './routes/indexes.js';
import { ndjsonRouter } from './routes/ingest/ndjson.js';
import { otlpRouter } from './routes/ingest/otlp.js';
import { settingsRouter } from './routes/settings.js';
import { sharesRouter } from './routes/shares.js';
import { apiKeysRouter } from './routes/api-keys.js';
import { usersRouter } from './routes/users.js';
import type { ApiErrorBody, ApiErrorDetail } from './types.js';
import { HttpError } from './utils/http-error.js';
import { quickwitErrorToHttp } from './utils/quickwit-error.js';
import { Code, otlpError, otlpErrorFromHttpError } from './utils/otlp-response.js';
import { getBetterAuthSecret } from './lib/secret.js';
import { startStatsCollector } from './services/index-stats.service.js';
import { openAPIRouteHandler } from 'hono-openapi';
import { specOptions } from './lib/openapi/spec.js';

// Resolves to apps/web/build from both src/app.ts (dev) and dist/app.js (prod): both are two segments deep in apps/api.
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/build');

function isApiPath(p: string): boolean {
	return p === '/api' || p === '/v1' || p.startsWith('/api/') || p.startsWith('/v1/');
}

function withAuth<E extends AuthedEnv, S extends Schema>(router: Hono<E, S, ''>) {
	return new Hono<AppEnv>().use('*', requireUser).route('/', router);
}

function errorJson(c: Context, body: ApiErrorBody['error'], status: ContentfulStatusCode) {
	return c.json({ error: body }, status);
}

export const app = new Hono<AppEnv>();

app.use('*', requestContext);
const allowedOrigins = new Set([
	config.origin,
	...(config.frontendUrl ? [config.frontendUrl] : [])
]);
app.use(
	'*',
	cors({
		origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
		credentials: true
	})
);

app.onError((rawErr, c) => {
	const requestId = c.get('requestId');
	let err: Error = rawErr;
	if (rawErr instanceof QuickwitError) {
		err = quickwitErrorToHttp(rawErr);
	}

	const logLine =
		err instanceof HttpError
			? `[onError] requestId=${requestId} path=${c.req.path} status=${err.statusCode} code=${err.code} message=${err.message}`
			: `[onError] requestId=${requestId} path=${c.req.path} name=${err.name} code=${String((err as { code?: unknown }).code)} message=${err.message}`;

	if (c.req.path.startsWith('/v1/')) {
		if (err instanceof HttpError) {
			if (err.retryAfter != null) {
				console.warn(logLine);
			} else if (err.statusCode >= 500) {
				console.error(logLine);
			}
			return otlpErrorFromHttpError(err);
		}
		console.error(logLine);
		return otlpError(503, Code.UNAVAILABLE, 'Upstream unavailable', 5);
	}

	if (err instanceof HttpError) {
		const isServerError = err.statusCode >= 500;
		// retryAfter marks a client-safe transient error: keep its message, warn-log, advertise Retry-After. Genuine faults stay masked + error-logged.
		const isTransient = err.retryAfter != null;
		if (isTransient) {
			console.warn(logLine);
		} else if (isServerError) {
			console.error(logLine);
		}
		if (isTransient) {
			c.header('Retry-After', String(err.retryAfter));
		}
		const maskMessage = isServerError && !isTransient;
		return errorJson(
			c,
			{
				code: err.code,
				message: maskMessage ? 'Internal server error' : err.message,
				statusCode: err.statusCode,
				requestId,
				...(!maskMessage && err.details ? { details: err.details } : {})
			},
			err.statusCode as ContentfulStatusCode
		);
	}

	if (err instanceof ValiError) {
		const details: ApiErrorDetail[] = err.issues.map((issue) => ({
			path:
				Array.isArray(issue.path) && issue.path.length > 0
					? issue.path.map((p: { key: unknown }) => String(p.key)).join('.')
					: '(root)',
			message: issue.message
		}));
		return errorJson(
			c,
			{
				code: 'VALIDATION_FAILED',
				message: 'Request validation failed',
				statusCode: 400,
				requestId,
				details
			},
			400
		);
	}

	if (err instanceof SyntaxError) {
		return errorJson(
			c,
			{ code: 'INVALID_JSON', message: 'Invalid JSON body', statusCode: 400, requestId },
			400
		);
	}

	console.error(logLine);
	return errorJson(
		c,
		{ code: 'INTERNAL', message: 'Internal server error', statusCode: 500, requestId },
		500
	);
});

app.notFound((c) => {
	if (c.req.path.startsWith('/v1/')) {
		return otlpError(404, Code.NOT_FOUND, 'Route not found');
	}
	return errorJson(
		c,
		{
			code: 'ROUTE_NOT_FOUND',
			message: 'Route not found',
			statusCode: 404,
			requestId: c.get('requestId')
		},
		404
	);
});

export const routes = app
	.route('/api/health', healthRouter)
	.route('/api/auth', authRouter)
	.route('/api/indexes', indexesRouter)
	.route('/api/admin/metrics', withAuth(metricsRouter))
	.route('/api/admin/cluster', withAuth(clusterRouter))
	.route('/api/admin/activity', withAuth(adminActivityRouter))
	.route('/api/users', withAuth(usersRouter))
	.route('/api/api-keys', withAuth(apiKeysRouter))
	.route('/api/shares', withAuth(sharesRouter))
	.route('/api/settings', withAuth(settingsRouter))
	.route('/api/ingest', ndjsonRouter)
	.route('/v1', otlpRouter);

app.get('/api/openapi.json', openAPIRouteHandler(app, specOptions));

// SPA static-file serving. Mounted AFTER `routes` so /api and /v1 keep their handlers and app.notFound still emits the JSON 404 contract; each handler bails on API paths via isApiPath().
app.use('*', async (c, next) => {
	if (isApiPath(c.req.path)) return next();
	await next();
	if (c.req.path.startsWith('/_app/immutable/')) {
		c.header('Cache-Control', 'public, max-age=31536000, immutable');
	} else {
		c.header('Cache-Control', 'no-cache');
	}
});

app.use('*', async (c, next) => {
	if (isApiPath(c.req.path)) return next();
	return serveStatic({ root: webRoot })(c, next);
});

// SPA fallback: anything still unmatched gets index.html.
app.get('*', async (c, next) => {
	if (isApiPath(c.req.path)) return next();
	return serveStatic({ path: 'index.html', root: webRoot })(c, next);
});

async function main(): Promise<void> {
	await connectDb();
	await runMigrations();

	const secret = await getBetterAuthSecret(db);
	await probeQuickwit();
	await initAuth(secret);

	const statsCollector = startStatsCollector(db, quickwit);

	const server = Bun.serve({
		fetch: app.fetch,
		hostname: '0.0.0.0',
		port: config.port,
		idleTimeout: 255
	});

	const shutdown = () => {
		statsCollector.stop();
		server.stop(true);
		process.exit(0);
	};
	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
}

if (import.meta.main) {
	main().catch((err) => {
		console.error('Boot failed:', err);
		process.exit(1);
	});
}

export type RoutesWithErrors = ApplyGlobalResponse<
	typeof routes,
	{
		400: { json: ApiErrorBody };
		401: { json: ApiErrorBody };
		403: { json: ApiErrorBody };
		404: { json: ApiErrorBody };
		409: { json: ApiErrorBody };
		413: { json: ApiErrorBody };
		415: { json: ApiErrorBody };
		422: { json: ApiErrorBody };
		429: { json: ApiErrorBody };
		500: { json: ApiErrorBody };
		503: { json: ApiErrorBody };
	}
>;
