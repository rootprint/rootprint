import * as v from 'valibot';

import type { Filter, SortDirection } from '../types.js';

export const FilterSchema: v.GenericSchema<Filter> = v.object({
	field: v.pipe(v.string(), v.minLength(1)),
	value: v.pipe(v.string(), v.minLength(1)),
	exclude: v.boolean()
});

export const SortDirectionSchema: v.GenericSchema<SortDirection> = v.picklist(['asc', 'desc']);
