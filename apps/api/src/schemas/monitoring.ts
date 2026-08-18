import * as v from 'valibot';

import { intParam, toNum } from '../utils/valibot.js';

const MAX_RANGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_BUCKETS = 2_000;

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
		startTs: intParam({ min: 0, label: 'startTs' }),
		endTs: intParam({ min: 0, label: 'endTs' }),
		interval,
		endpointLimit: v.optional(
			v.pipe(
				toNum,
				v.check((value) => value === 10 || value === 20 || value === 30, 'Invalid endpoint limit')
			),
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
