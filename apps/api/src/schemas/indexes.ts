import * as v from 'valibot';

import { FIELD_VALUES_MAX, INDEX_VIEWS, INDEX_VISIBILITIES } from '../constants.js';
import { FilterSchema } from './filters.js';
import { IndexIdParams } from '../utils/params.js';
import { intParam, toNum } from '../utils/valibot.js';

const dedupedStrings = v.pipe(
	v.array(v.pipe(v.string(), v.minLength(1))),
	v.transform((arr) => [...new Set(arr)])
);

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
	...IndexIdParams.entries,
	sourceId: v.pipe(v.string(), v.minLength(1))
});

export const ToggleSourceBody = v.object({ enabled: v.boolean() });

export const FieldParams = v.object({
	...IndexIdParams.entries,
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
	view: v.optional(v.picklist(INDEX_VIEWS))
});

export const FIELD_TYPES = ['text', 'i64', 'u64', 'f64', 'bool', 'datetime', 'ip', 'json'] as const;

export const TOKENIZERS = [
	'raw',
	'raw_lowercase',
	'default',
	'en_stem',
	'whitespace',
	'chinese_compatible',
	'lowercase'
] as const;

export const RECORD_OPTIONS = ['basic', 'freq', 'position'] as const;

export const INDEX_MODES = ['dynamic', 'lenient', 'strict'] as const;

export const FAST_PRECISIONS = ['seconds', 'milliseconds', 'microseconds', 'nanoseconds'] as const;

export const DATETIME_OUTPUT_FORMATS = [
	'rfc3339',
	'unix_timestamp_secs',
	'unix_timestamp_millis',
	'unix_timestamp_micros',
	'unix_timestamp_nanos'
] as const;

const indexId = v.pipe(
	v.string(),
	v.regex(
		/^[a-zA-Z][a-zA-Z0-9_-]{2,254}$/,
		'Index ID must start with a letter and be 3–255 characters (letters, digits, - or _).'
	)
);

const fieldName = v.pipe(
	v.string(),
	v.regex(
		/^[@$_\-a-zA-Z][@$_/.\-a-zA-Z0-9]{0,254}$/,
		'Field name must start with a letter, "@", "$", "_" or "-", then contain only letters, digits, or . - _ / @ $ (max 255 characters).'
	)
);

const commonFieldOpts = {
	stored: v.optional(v.boolean()),
	indexed: v.optional(v.boolean()),
	fast: v.optional(v.boolean())
};

const numericFieldOpts = {
	...commonFieldOpts,
	coerce: v.optional(v.boolean())
};

const textField = v.object({
	name: fieldName,
	type: v.literal('text'),
	...commonFieldOpts,
	tokenizer: v.optional(v.picklist(TOKENIZERS)),
	record: v.optional(v.picklist(RECORD_OPTIONS)),
	fieldnorms: v.optional(v.boolean())
});

const jsonField = v.object({
	name: fieldName,
	type: v.literal('json'),
	...commonFieldOpts,
	tokenizer: v.optional(v.picklist(TOKENIZERS)),
	record: v.optional(v.picklist(RECORD_OPTIONS)),
	expandDots: v.optional(v.boolean())
});

const datetimeField = v.object({
	name: fieldName,
	type: v.literal('datetime'),
	...commonFieldOpts,
	inputFormats: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.minLength(1))),
	outputFormat: v.optional(v.picklist(DATETIME_OUTPUT_FORMATS)),
	fastPrecision: v.optional(v.picklist(FAST_PRECISIONS))
});

const i64Field = v.object({ name: fieldName, type: v.literal('i64'), ...numericFieldOpts });
const u64Field = v.object({ name: fieldName, type: v.literal('u64'), ...numericFieldOpts });
const f64Field = v.object({ name: fieldName, type: v.literal('f64'), ...numericFieldOpts });
const boolField = v.object({ name: fieldName, type: v.literal('bool'), ...commonFieldOpts });
const ipField = v.object({ name: fieldName, type: v.literal('ip'), ...commonFieldOpts });

const fieldMapping = v.variant('type', [
	textField,
	i64Field,
	u64Field,
	f64Field,
	boolField,
	datetimeField,
	ipField,
	jsonField
]);

export type FieldMappingInput = v.InferOutput<typeof fieldMapping>;

const retention = v.object({
	period: v.pipe(v.string(), v.minLength(1, 'Retention period is required.')),
	schedule: v.optional(v.pipe(v.string(), v.minLength(1)))
});

export const RESERVED_FIELD_NAMES = ['_source', '_dynamic', '_field_presence'];

export const createIndexSchema = v.pipe(
	v.object({
		indexId,
		indexUri: v.optional(v.pipe(v.string(), v.minLength(1))),
		mode: v.optional(v.picklist(INDEX_MODES)),
		timestampField: v.pipe(v.string(), v.minLength(1, 'Timestamp field is required.')),
		fieldMappings: v.pipe(
			v.array(fieldMapping),
			v.minLength(1, 'At least one field mapping is required.')
		),
		defaultSearchFields: v.optional(dedupedStrings),
		tagFields: v.optional(dedupedStrings),
		storeSource: v.optional(v.boolean()),
		indexFieldPresence: v.optional(v.boolean()),
		commitTimeoutSecs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
		retention: v.optional(retention)
	}),
	v.forward(
		v.check(
			(input) =>
				new Set(input.fieldMappings.map((f) => f.name)).size === input.fieldMappings.length,
			'Field names must be unique.'
		),
		['fieldMappings']
	),
	v.forward(
		v.check(
			(input) => input.fieldMappings.some((f) => f.name === input.timestampField),
			'timestamp_field must reference a defined field.'
		),
		['timestampField']
	),
	v.forward(
		v.check((input) => {
			const field = input.fieldMappings.find((f) => f.name === input.timestampField);
			return !field || field.type === 'datetime';
		}, 'timestamp_field must reference a datetime field.'),
		['timestampField']
	),
	v.forward(
		v.check(
			(input) => input.fieldMappings.every((f) => !RESERVED_FIELD_NAMES.includes(f.name)),
			'Field name is reserved by Quickwit.'
		),
		['fieldMappings']
	)
);

export type CreateIndexInput = v.InferOutput<typeof createIndexSchema>;

export const updateQuickwitConfigSchema = v.pipe(
	v.object({
		mode: v.picklist(INDEX_MODES),
		defaultSearchFields: dedupedStrings,
		tagFields: dedupedStrings,
		storeSource: v.boolean(),
		indexFieldPresence: v.boolean(),
		commitTimeoutSecs: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
		retention: v.nullable(retention),
		newFieldMappings: v.array(fieldMapping)
	}),
	v.forward(
		v.check(
			(input) =>
				new Set(input.newFieldMappings.map((f) => f.name)).size === input.newFieldMappings.length,
			'Field names must be unique.'
		),
		['newFieldMappings']
	),
	v.forward(
		v.check(
			(input) => input.newFieldMappings.every((f) => !RESERVED_FIELD_NAMES.includes(f.name)),
			'Field name is reserved by Quickwit.'
		),
		['newFieldMappings']
	)
);

export type UpdateQuickwitConfigInput = v.InferOutput<typeof updateQuickwitConfigSchema>;
