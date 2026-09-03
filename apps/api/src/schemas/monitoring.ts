import * as v from 'valibot';

import {
	ERROR_HTTP_STATUSES,
	ERROR_PAGE_SIZE,
	MAX_ERROR_LIMIT,
	MAX_ERROR_OFFSET,
	SPAN_KINDS
} from '../constants.js';
import { EPOCH_SECONDS, intParam } from '../utils/valibot.js';

const MAX_RANGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_BUCKETS = 2_000;
const MAX_ENDPOINT_LIMIT = 100;

// Narrower than the log histogram's interval (which also takes w, M, y): the bucket-count check
// below needs a fixed second count, and weeks/months/years don't have one.
const interval = v.pipe(
	v.string(),
	v.regex(/^[1-9]\d*[smhd]$/, 'interval must use seconds, minutes, hours, or days')
);

export function intervalSeconds(value: string): number {
	const amount = Number(value.slice(0, -1));
	const unit = value.at(-1);
	if (unit === 'd') return amount * 86_400;
	if (unit === 'h') return amount * 3_600;
	if (unit === 'm') return amount * 60;
	return amount;
}

export const ServiceHealthQuery = v.pipe(
	v.object({
		service: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
		startTs: v.pipe(intParam({ min: 0, label: 'startTs' }), v.description(EPOCH_SECONDS)),
		endTs: v.pipe(intParam({ min: 0, label: 'endTs' }), v.description(EPOCH_SECONDS)),
		interval,
		endpointLimit: v.optional(
			intParam({ min: 1, max: MAX_ENDPOINT_LIMIT, label: 'endpointLimit' }),
			'10'
		)
	}),
	v.check((input) => input.startTs < input.endTs, 'startTs must be before endTs'),
	v.check(
		(input) => input.endTs - input.startTs <= MAX_RANGE_SECONDS,
		'Monitoring range cannot exceed 30 days'
	),
	v.check(
		(input) => (input.endTs - input.startTs) / intervalSeconds(input.interval) <= MAX_BUCKETS,
		'interval produces too many buckets'
	)
);

export type ServiceHealthInput = v.InferOutput<typeof ServiceHealthQuery>;

export const ServiceErrorsQuery = v.pipe(
	v.object({
		service: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
		startTs: v.pipe(intParam({ min: 0, label: 'startTs' }), v.description(EPOCH_SECONDS)),
		endTs: v.pipe(intParam({ min: 0, label: 'endTs' }), v.description(EPOCH_SECONDS)),
		operation: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500))),
		kind: v.optional(v.picklist(SPAN_KINDS)),
		httpStatus: v.optional(v.picklist(ERROR_HTTP_STATUSES)),
		limit: v.optional(
			intParam({ min: 1, max: MAX_ERROR_LIMIT, label: 'limit' }),
			String(ERROR_PAGE_SIZE)
		),
		offset: v.optional(intParam({ min: 0, max: MAX_ERROR_OFFSET, label: 'offset' }), '0')
	}),
	v.check((input) => input.startTs < input.endTs, 'startTs must be before endTs'),
	v.check(
		(input) => input.endTs - input.startTs <= MAX_RANGE_SECONDS,
		'Monitoring range cannot exceed 30 days'
	)
);

export type ServiceErrorsInput = v.InferOutput<typeof ServiceErrorsQuery>;
