import { create, toBinary, toJson } from '@bufbuild/protobuf';
import type { DescMessage, MessageShape } from '@bufbuild/protobuf';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PROTOBUF } from '../constants.js';
import { Code } from '../gen/google/rpc/code_pb.js';
import { StatusSchema } from '../gen/google/rpc/status_pb.js';
import { ExportLogsServiceResponseSchema } from '../gen/opentelemetry/proto/collector/logs/v1/logs_service_pb.js';
import { ExportTraceServiceResponseSchema } from '../gen/opentelemetry/proto/collector/trace/v1/trace_service_pb.js';
import { HttpError } from './http-error.js';

export { Code };

export function otlpEncoding(contentType: string | undefined): 'json' | 'protobuf' | null {
	const base = contentType?.split(';')[0]?.trim().toLowerCase();
	if (base === CONTENT_TYPE_JSON) return 'json';
	return base === CONTENT_TYPE_PROTOBUF ? 'protobuf' : null;
}

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
): { rejected: bigint; errorMessage: string } | null {
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
	return { rejected: BigInt(rejected), errorMessage };
}

function encode<Desc extends DescMessage>(
	schema: Desc,
	message: MessageShape<Desc>,
	json: boolean,
	status: number,
	retryAfter?: number | string
): Response {
	const headers: Record<string, string> = {
		'content-type': json ? CONTENT_TYPE_JSON : CONTENT_TYPE_PROTOBUF
	};
	if (retryAfter !== undefined) headers['retry-after'] = String(retryAfter);
	const body = json ? JSON.stringify(toJson(schema, message)) : toBinary(schema, message);
	return new Response(body, { status, headers });
}

/**
 * Quickwit answers OTLP/HTTP with its own JSON, which an exporter cannot decode, so re-encode while
 * carrying over its rejected-record count.
 */
export function otlpSuccess(
	signal: 'logs' | 'traces',
	bodyBytes: ArrayBuffer,
	json: boolean
): Response {
	const ps = readPartialSuccess(signal, bodyBytes);
	if (signal === 'traces') {
		const partialSuccess = ps && { rejectedSpans: ps.rejected, errorMessage: ps.errorMessage };
		const message = create(
			ExportTraceServiceResponseSchema,
			partialSuccess ? { partialSuccess } : {}
		);
		return encode(ExportTraceServiceResponseSchema, message, json, 200);
	}
	const partialSuccess = ps && { rejectedLogRecords: ps.rejected, errorMessage: ps.errorMessage };
	const message = create(ExportLogsServiceResponseSchema, partialSuccess ? { partialSuccess } : {});
	return encode(ExportLogsServiceResponseSchema, message, json, 200);
}

export function otlpError(
	httpStatus: number,
	code: number,
	message: string,
	json: boolean,
	retryAfter?: number | string
): Response {
	return encode(
		StatusSchema,
		create(StatusSchema, { code, message }),
		json,
		httpStatus,
		retryAfter
	);
}

function statusToGrpcCode(status: number): number {
	if (status === 401) return Code.UNAUTHENTICATED;
	if (status === 403) return Code.PERMISSION_DENIED;
	if (status === 404) return Code.NOT_FOUND;
	if (status === 429) return Code.RESOURCE_EXHAUSTED;
	if (status >= 400 && status < 500) return Code.INVALID_ARGUMENT;
	return Code.UNAVAILABLE;
}

export function otlpErrorFromHttpError(err: HttpError, json: boolean): Response {
	// An exporter sending the wrong content-type may not decode protobuf back.
	const asJson = json || err.code === 'CONTENT_TYPE_UNSUPPORTED';
	const grpcCode = statusToGrpcCode(err.statusCode);
	const retryAfter =
		err.retryAfter ?? (err.statusCode === 429 || err.statusCode >= 500 ? 5 : undefined);
	const message = err.statusCode >= 500 ? 'Upstream unavailable' : err.message;
	// Clamp 5xx to 503 — semantically retryable for OTLP clients.
	const httpStatus = err.statusCode >= 500 ? 503 : err.statusCode;
	return otlpError(httpStatus, grpcCode, message, asJson, retryAfter);
}
