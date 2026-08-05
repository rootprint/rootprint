import { create, toBinary, toJson } from '@bufbuild/protobuf';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PROTOBUF } from '../constants.js';
import { Code } from '../gen/google/rpc/code_pb.js';
import { StatusSchema } from '../gen/google/rpc/status_pb.js';
import { ExportLogsServiceResponseSchema } from '../gen/opentelemetry/proto/collector/logs/v1/logs_service_pb.js';
import { HttpError } from './http-error.js';

export { Code };

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null;
}

/** prost serialises int64 as a JSON number; protobuf-JSON also permits a string. Accept both. */
function toCount(v: unknown): number {
	const n = typeof v === 'string' ? Number(v) : v;
	return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function readPartialSuccess(
	signal: 'logs' | 'traces',
	bodyBytes: ArrayBuffer
): { rejectedLogRecords: bigint; errorMessage: string } | null {
	const text = new TextDecoder().decode(bodyBytes).trim();
	if (!text) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}
	if (!isRecord(parsed)) return null;

	const ps = parsed.partial_success ?? parsed.partialSuccess;
	if (!isRecord(ps)) return null;

	const rejectedRaw =
		signal === 'traces'
			? (ps.rejected_spans ?? ps.rejectedSpans)
			: (ps.rejected_log_records ?? ps.rejectedLogRecords);
	const rejected = toCount(rejectedRaw);
	const messageRaw = ps.error_message ?? ps.errorMessage;
	const errorMessage = typeof messageRaw === 'string' ? messageRaw : '';

	// Quickwit sends partial_success even on a full success, and OTLP treats an empty one as unset.
	if (rejected === 0 && errorMessage === '') return null;
	return { rejectedLogRecords: BigInt(rejected), errorMessage };
}

/**
 * Quickwit answers OTLP/HTTP with JSON, which a protobuf exporter cannot decode, so re-encode while
 * carrying over its rejected-record count. One schema covers both signals: ExportLogsServiceResponse
 * and ExportTraceServiceResponse have identical wire shapes.
 */
export function otlpSuccess(signal: 'logs' | 'traces', bodyBytes: ArrayBuffer): Response {
	const partialSuccess = readPartialSuccess(signal, bodyBytes);
	const body = toBinary(
		ExportLogsServiceResponseSchema,
		create(ExportLogsServiceResponseSchema, partialSuccess ? { partialSuccess } : {})
	);
	return new Response(body, {
		status: 200,
		headers: { 'content-type': CONTENT_TYPE_PROTOBUF }
	});
}

export function otlpError(
	httpStatus: number,
	code: number,
	message: string,
	retryAfter?: number | string
): Response {
	const body = toBinary(StatusSchema, create(StatusSchema, { code, message }));
	const headers: Record<string, string> = { 'content-type': CONTENT_TYPE_PROTOBUF };
	if (retryAfter !== undefined) headers['retry-after'] = String(retryAfter);
	return new Response(body, { status: httpStatus, headers });
}

export function unsupportedContentType(message: string): Response {
	const json = toJson(StatusSchema, create(StatusSchema, { code: Code.INVALID_ARGUMENT, message }));
	return new Response(JSON.stringify(json), {
		status: 415,
		headers: { 'content-type': CONTENT_TYPE_JSON }
	});
}

function statusToGrpcCode(status: number): number {
	if (status === 401) return Code.UNAUTHENTICATED;
	if (status === 403) return Code.PERMISSION_DENIED;
	if (status === 404) return Code.NOT_FOUND;
	if (status === 429) return Code.RESOURCE_EXHAUSTED;
	if (status >= 400 && status < 500) return Code.INVALID_ARGUMENT;
	return Code.UNAVAILABLE;
}

export function otlpErrorFromHttpError(err: HttpError): Response {
	if (err.statusCode === 415 && err.code === 'CONTENT_TYPE_UNSUPPORTED') {
		return unsupportedContentType(err.message);
	}
	const grpcCode = statusToGrpcCode(err.statusCode);
	const retryAfter =
		err.retryAfter ?? (err.statusCode === 429 || err.statusCode >= 500 ? 5 : undefined);
	const message = err.statusCode >= 500 ? 'Upstream unavailable' : err.message;
	// Clamp 5xx to 503 — semantically retryable for OTLP clients.
	const httpStatus = err.statusCode >= 500 ? 503 : err.statusCode;
	return otlpError(httpStatus, grpcCode, message, retryAfter);
}
