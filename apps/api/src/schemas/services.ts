import * as v from 'valibot';

import {
	ERROR_HTTP_STATUSES,
	ERROR_PAGE_SIZE,
	MAX_ERROR_LIMIT,
	MAX_ERROR_OFFSET,
	SPAN_KINDS
} from '../constants.js';
import { EPOCH_SECONDS, intParam } from '../utils/valibot.js';

const MAX_BUCKETS = 2_000;
const MAX_ENDPOINT_LIMIT = 100;

// No w, M or y: Quickwit's date histogram rejects them, and the bucket-count checks need a fixed
// second count.
export const intervalParam = v.pipe(
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

export function withinBucketCap(rangeSeconds: number, interval: string): boolean {
	return rangeSeconds / intervalSeconds(interval) <= MAX_BUCKETS;
}

export const ServiceHealthQuery = v.pipe(
	v.object({
		service: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
		startTs: v.pipe(intParam({ min: 0, label: 'startTs' }), v.description(EPOCH_SECONDS)),
		endTs: v.pipe(intParam({ min: 0, label: 'endTs' }), v.description(EPOCH_SECONDS)),
		interval: intervalParam,
		/** Ignored without `service`; 0 skips the endpoint searches, for views that don't show endpoints. */
		endpointLimit: v.optional(
			intParam({ min: 0, max: MAX_ENDPOINT_LIMIT, label: 'endpointLimit' }),
			'10'
		)
	}),
	v.check((input) => input.startTs < input.endTs, 'startTs must be before endTs'),
	v.check(
		(input) => withinBucketCap(input.endTs - input.startTs, input.interval),
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
	v.check((input) => input.startTs < input.endTs, 'startTs must be before endTs')
);

export type ServiceErrorsInput = v.InferOutput<typeof ServiceErrorsQuery>;
