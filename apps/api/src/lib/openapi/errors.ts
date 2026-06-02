import * as v from 'valibot';
import { resolver, type ResponsesWithResolver } from 'hono-openapi';

// Mirrors the ApiErrorBody emitted by app.onError. Tagged with a `ref` so it is
// hoisted into components.schemas and referenced once, not inlined per response.
export const ApiErrorBody = v.pipe(
	v.object({
		error: v.object({
			code: v.string(),
			message: v.string(),
			statusCode: v.number(),
			requestId: v.string(),
			details: v.optional(v.array(v.object({ path: v.string(), message: v.string() })))
		})
	}),
	v.metadata({ ref: 'ApiErrorBody' })
);

const ERRORS: Record<number, { name: string; description: string }> = {
	400: { name: 'BadRequest', description: 'Request validation failed' },
	401: { name: 'Unauthorized', description: 'Authentication required' },
	403: { name: 'Forbidden', description: 'Permission denied' },
	404: { name: 'NotFound', description: 'Resource not found' },
	409: { name: 'Conflict', description: 'Conflict with current resource state' },
	413: { name: 'PayloadTooLarge', description: 'Payload too large' },
	415: { name: 'UnsupportedMediaType', description: 'Unsupported media type' },
	422: { name: 'UnprocessableEntity', description: 'Unprocessable request' },
	429: { name: 'TooManyRequests', description: 'Rate limit exceeded' },
	500: { name: 'InternalError', description: 'Internal server error' },
	503: { name: 'ServiceUnavailable', description: 'Upstream service unavailable' }
};

// Documented on every route: auth/permission/not-found, validation, and upstream failures.
const BASELINE = [400, 401, 403, 404, 500, 503] as const;

/** Reusable error responses registered under `components.responses`. */
export const errorResponseComponents: ResponsesWithResolver = Object.fromEntries(
	Object.values(ERRORS).map(({ name, description }) => [
		name,
		{ description, content: { 'application/json': { schema: resolver(ApiErrorBody) } } }
	])
);

/** Build a route's error `responses` map as `$ref`s into the shared components. */
export function errorResponses(extra: number[] = []): Record<string, unknown> {
	const codes = Array.from(new Set([...BASELINE, ...extra])).toSorted((a, b) => a - b);
	const out: Record<string, unknown> = {};
	for (const code of codes) {
		out[String(code)] = { $ref: `#/components/responses/${ERRORS[code].name}` };
	}
	return out;
}
