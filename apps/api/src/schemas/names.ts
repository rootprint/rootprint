import * as v from 'valibot';

export function boundedName(label: string, max: number) {
	return v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, `${label} is required`),
		v.maxLength(max, `${label} must be ${max} characters or fewer`)
	);
}
