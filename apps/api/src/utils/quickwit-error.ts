import { QuickwitError, QuickwitErrorCode } from 'quickwit-js';

import {
	HttpError,
	badRequest,
	forbidden,
	notFound,
	serviceUnavailable,
	unauthorized
} from './http-error.js';

/** Seconds advertised in Retry-After for transient upstream failures. Matches the OTLP /v1 path. */
const UPSTREAM_RETRY_AFTER_SECONDS = 5;

/**
 * Maps a Quickwit client error onto an HttpError, classifying by its `code`.
 *
 * Client-fault codes keep their precise status. Every transient/backend class
 * (connection refused, timeout, upstream 5xx, unknown) collapses to a single
 * 503 with Retry-After — quickwit-js wraps network failures in ConnectionError/
 * TimeoutError, which carry no `status`, so they must be classified by code, not
 * by `status ?? 500`.
 */
export function quickwitErrorToHttp(err: QuickwitError): HttpError {
	switch (err.code) {
		case QuickwitErrorCode.VALIDATION_ERROR:
		case QuickwitErrorCode.BAD_REQUEST:
			return badRequest(err.message, 'QUICKWIT_VALIDATION');
		case QuickwitErrorCode.NOT_FOUND:
			return notFound('Index not found', 'INDEX_NOT_FOUND');
		case QuickwitErrorCode.UNAUTHORIZED:
			return unauthorized('Search backend rejected the request', 'QUICKWIT_UNAUTHORIZED');
		case QuickwitErrorCode.FORBIDDEN:
			return forbidden('Search backend rejected the request', 'QUICKWIT_FORBIDDEN');
		case QuickwitErrorCode.CONNECTION_ERROR:
		case QuickwitErrorCode.TIMEOUT:
		case QuickwitErrorCode.INTERNAL_SERVER_ERROR:
		case QuickwitErrorCode.SERVICE_UNAVAILABLE:
		case QuickwitErrorCode.UNKNOWN:
		default:
			return serviceUnavailable(
				'Search backend is temporarily unavailable — please retry',
				'UPSTREAM_UNAVAILABLE',
				UPSTREAM_RETRY_AFTER_SECONDS
			);
	}
}

/** Maps Quickwit client errors onto HTTP errors; re-throws anything unrecognized. */
export function translateQuickwitError(err: unknown): never {
	if (err instanceof QuickwitError) throw quickwitErrorToHttp(err);
	throw err;
}
