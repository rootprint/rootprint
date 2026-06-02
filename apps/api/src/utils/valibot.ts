import * as v from 'valibot';

/** A string query/path param coerced to a finite number. */
export const toNum = v.pipe(v.string(), v.decimal(), v.transform(Number), v.number());

/**
 * A string query/path param coerced to an integer in `[min, max]`.
 * Accepts only non-negative integer strings (no decimals, signs, trailing chars).
 * Bounds are declarative so @valibot/to-json-schema emits {type:'integer', minimum, maximum}.
 */
export const intParam = ({
	min,
	max,
	label = 'value'
}: {
	min: number;
	max?: number;
	label?: string;
}) => {
	const base = v.pipe(
		v.string(),
		v.regex(/^\d+$/, `${label} must be a non-negative integer`),
		v.transform(Number),
		v.integer(),
		v.minValue(
			min,
			max === undefined ? `${label} must be >= ${min}` : `${label} must be ${min}–${max}`
		)
	);
	return max === undefined ? base : v.pipe(base, v.maxValue(max, `${label} must be ${min}–${max}`));
};

/** A string path/query param constrained to a positive integer, transformed to a number. */
export const positiveInt = (label = 'value') => intParam({ min: 1, label });
