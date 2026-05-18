import * as v from 'valibot';

export const toNum = v.pipe(
	v.string(),
	v.transform((s) => {
		const n = Number(s);
		if (!Number.isFinite(n)) throw new Error('must be a finite number');
		return n;
	})
);
