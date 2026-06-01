import { create, toBinary, toJson } from '@bufbuild/protobuf';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PROTOBUF } from '../constants.js';
import { Code } from '../gen/google/rpc/code_pb.js';
import { StatusSchema } from '../gen/google/rpc/status_pb.js';
import { ExportLogsServiceResponseSchema } from '../gen/opentelemetry/proto/collector/logs/v1/logs_service_pb.js';
import { HttpError } from './http-error.js';

export { Code };

const EMPTY_EXPORT_LOGS_RESPONSE = toBinary(
	ExportLogsServiceResponseSchema,
	create(ExportLogsServiceResponseSchema, {})
);

export function otlpSuccess(): Response {
	return new Response(EMPTY_EXPORT_LOGS_RESPONSE, {
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

export async function readUpstreamMessage(upstream: Response, fallback: string): Promise<string> {
	try {
		const text = await upstream.text();
		if (!text) return fallback;
		try {
			const parsed = JSON.parse(text) as unknown;
			if (
				parsed &&
				typeof parsed === 'object' &&
				'message' in parsed &&
				typeof (parsed as { message: unknown }).message === 'string'
			) {
				return (parsed as { message: string }).message;
			}
		} catch {
			// body was not JSON; fall through to raw text
		}
		return text.length > 512 ? text.slice(0, 512) : text;
	} catch {
		return fallback;
	}
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
