import * as v from 'valibot';

export const toNum = v.pipe(
	v.string(),
	v.transform((s) => {
		const n = Number(s);
		if (!Number.isFinite(n)) throw new Error('must be a finite number');
		return n;
	})
);

/**
 * A string query/path param coerced to an integer in `[min, max]`.
 * `max` omitted means unbounded above. Only non-negative integer strings are
 * accepted (no decimals, signs, or trailing characters).
 */
export const intParam = ({
	min,
	max,
	label = 'value'
}: {
	min: number;
	max?: number;
	label?: string;
}) =>
	v.pipe(
		v.string(),
		v.transform((s) => {
			const n = Number.parseInt(s, 10);
			const ok = /^\d+$/.test(s) && n >= min && (max === undefined || n <= max);
			if (!ok) {
				throw new Error(
					max === undefined ? `${label} must be >= ${min}` : `${label} must be ${min}–${max}`
				);
			}
			return n;
		})
	);

/** A string path/query param constrained to a positive integer, transformed to a number. */
export const positiveInt = (label = 'value') => intParam({ min: 1, label });
