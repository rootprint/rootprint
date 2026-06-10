import * as v from 'valibot';

import { FIELD_VALUES_MAX, INDEX_VISIBILITIES } from '../constants.js';
import { FilterSchema } from './filters.js';
import { intParam, toNum } from '../utils/valibot.js';

export const saveIndexConfigSchema = v.object({
	displayName: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(128)))),
	visibility: v.optional(v.picklist(INDEX_VISIBILITIES)),
	levelField: v.optional(v.pipe(v.string(), v.minLength(1))),
	messageField: v.optional(v.pipe(v.string(), v.minLength(1))),
	tracebackField: v.optional(v.nullable(v.pipe(v.string(), v.minLength(1)))),
	contextFields: v.optional(v.nullable(v.array(v.string())))
});

export type SaveIndexConfigInput = v.InferOutput<typeof saveIndexConfigSchema>;

export const SourceParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	sourceId: v.pipe(v.string(), v.minLength(1))
});

export const ToggleSourceBody = v.object({ enabled: v.boolean() });

export const FieldParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	field: v.pipe(v.string(), v.minLength(1))
});

export const HistogramQuery = v.object({
	q: v.optional(v.string()),
	startTs: v.optional(toNum),
	endTs: v.optional(toNum),
	interval: v.pipe(
		v.string(),
		v.regex(
			/^[1-9]\d*[smhdwMy]$/,
			'interval must be a positive integer followed by s, m, h, d, w, M, or y'
		)
	)
});

export const FieldValuesQuery = v.object({
	q: v.optional(v.string()),
	startTs: v.optional(toNum),
	endTs: v.optional(toNum),
	limit: v.optional(intParam({ min: 1, max: FIELD_VALUES_MAX, label: 'limit' }))
});

export const FieldValuesBulkQuery = v.object({
	fields: v.pipe(
		v.string(),
		v.minLength(1),
		v.transform((s) =>
			s
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean)
		),
		v.array(v.pipe(v.string(), v.minLength(1))),
		v.check((arr: string[]) => arr.length > 0, 'fields must include at least one field name')
	),
	q: v.optional(v.string()),
	filters: v.optional(v.pipe(v.string(), v.parseJson(), v.array(FilterSchema))),
	startTs: v.optional(toNum),
	endTs: v.optional(toNum),
	limit: v.optional(intParam({ min: 1, max: FIELD_VALUES_MAX, label: 'limit' }))
});

export const StatsQuery = v.object({
	from: v.optional(toNum),
	to: v.optional(toNum),
	limit: v.optional(intParam({ min: 1, max: 10000, label: 'limit' }))
});

export const PutPreferencesBody = v.object({
	displayFields: v.nullable(v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.maxLength(100))),
	lineWrap: v.boolean(),
	displayMode: v.picklist(['table', 'inline'])
});

export const ListIndexesQuery = v.object({
	// Fail closed: only the literal string "true" enables it; any other value is treated as false.
	includeHidden: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true')
		)
	)
});
