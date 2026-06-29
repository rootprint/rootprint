import * as v from 'valibot';

import type { Filter, SortDirection } from '../types.js';

export const fieldName = v.pipe(
	v.string(),
	v.regex(
		/^[@$_\-a-zA-Z][@$_/.\-a-zA-Z0-9]{0,254}$/,
		'Field name must start with a letter, "@", "$", "_" or "-", then contain only letters, digits, or . - _ / @ $ (max 255 characters).'
	)
);

export const FilterSchema: v.GenericSchema<Filter> = v.object({
	field: fieldName,
	value: v.pipe(v.string(), v.minLength(1)),
	exclude: v.boolean()
});

export const SortDirectionSchema: v.GenericSchema<SortDirection> = v.picklist(['asc', 'desc']);
