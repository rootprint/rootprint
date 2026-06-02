import type { StandardSchemaV1 } from '@standard-schema/spec';
import * as v from 'valibot';
import {
	validator as honoValidator,
	resolver,
	describeRoute,
	type DescribeRouteOptions
} from 'hono-openapi';

import { HttpError } from '../../utils/http-error.js';
import type { ApiErrorDetail } from '../../types.js';
import { errorResponses } from './errors.js';

/**
 * Tag a schema with a `ref` so the OpenAPI generator hoists it into
 * `components.schemas` and emits `$ref`s instead of inlining it at every use.
 */
function named<S extends StandardSchemaV1>(ref: string, schema: S) {
	return v.pipe(schema as unknown as v.GenericSchema, v.metadata({ ref })) as unknown as S;
}

/**
 * Thin wrapper over hono-openapi's `validator` that reproduces the app's 400
 * contract (mapping Standard Schema issues to `ApiErrorDetail[]` exactly as
 * `app.onError` does for ValiError) and forwards `typeMode: 'output'` to
 * @valibot/to-json-schema.
 */
function validator<
	S extends StandardSchemaV1,
	Target extends 'json' | 'query' | 'param' | 'header'
>(target: Target, schema: S) {
	return honoValidator(
		target,
		schema,
		(result: {
			success: boolean;
			error?: ReadonlyArray<{
				message: string;
				path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined;
			}>;
		}) => {
			if (!result.success) {
				const details: ApiErrorDetail[] = (result.error ?? []).map((issue) => {
					const path =
						Array.isArray(issue.path) && issue.path.length > 0
							? issue.path
									.map((seg) =>
										typeof seg === 'object' && seg !== null && 'key' in seg
											? String(seg.key)
											: String(seg)
									)
									.join('.')
							: '(root)';
					return { path, message: issue.message };
				});
				throw new HttpError(400, 'VALIDATION_FAILED', 'Request validation failed', details);
			}
		},
		{ options: { typeMode: 'output' } }
	);
}

function jsonResponse(schema: StandardSchemaV1, description: string) {
	return {
		description,
		content: { 'application/json': { schema: resolver(schema) } }
	};
}

type DescribeArgs = {
	tag: string;
	summary: string;
	description?: string;
	/** Valibot schema for the 2xx success response body */
	ok?: StandardSchemaV1;
	/** HTTP status code for the success response (default: 200) */
	okStatus?: number;
	okDescription?: string;
	/** Error status codes to document beyond the baseline (400/401/403/404/500/503) */
	errors?: number[];
	security?: NonNullable<DescribeRouteOptions['security']>;
	/**
	 * Raw OpenAPI response objects merged in last (final precedence) — for
	 * non-JSON bodies (binary, protobuf, downloads) or non-standard error shapes.
	 */
	rawResponses?: Record<string, unknown>;
};

function describe(args: DescribeArgs) {
	const {
		tag,
		summary,
		description,
		ok,
		okStatus = 200,
		okDescription = 'Successful response',
		errors = [],
		security,
		rawResponses
	} = args;

	const successResponses: Record<string, unknown> = {};
	if (ok) successResponses[String(okStatus)] = jsonResponse(ok, okDescription);

	const responses = {
		...successResponses,
		...errorResponses(errors),
		...rawResponses
	} as DescribeRouteOptions['responses'];

	return describeRoute({
		tags: [tag],
		summary,
		...(description !== undefined ? { description } : {}),
		responses,
		...(security !== undefined ? { security } : {})
	});
}

export { named, validator, describe };
