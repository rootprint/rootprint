import {
	BYTES_FORMATS,
	DATETIME_OUTPUT_FORMATS,
	FAST_PRECISIONS,
	FIELD_TYPES,
	INDEX_MODES,
	RECORD_OPTIONS,
	TOKENIZERS
} from 'api/schemas';
import type { CreateIndexInput, FieldMappingInput } from 'api/schemas';
import type { DynamicMapping } from 'api/types';

import { lines } from '#lib/components/settings/indexes/lines.js';

export type FieldType = (typeof FIELD_TYPES)[number];
type Tokenizer = (typeof TOKENIZERS)[number];
type RecordOption = (typeof RECORD_OPTIONS)[number];
export type IndexMode = (typeof INDEX_MODES)[number];
type FastPrecision = (typeof FAST_PRECISIONS)[number];
type DatetimeOutputFormat = (typeof DATETIME_OUTPUT_FORMATS)[number];
type BytesFormat = (typeof BYTES_FORMATS)[number];

export type DynamicMappingForm = {
	indexed: boolean;
	stored: boolean;
	fast: boolean;
	tokenizer: Tokenizer;
	record: RecordOption;
	expandDots: boolean;
};

function defaultDynamicMapping(): DynamicMappingForm {
	return {
		indexed: true,
		stored: true,
		fast: true,
		tokenizer: 'raw',
		record: 'basic',
		expandDots: true
	};
}

// Unknown tokenizer/record values (e.g. a custom tokenizer set out-of-band) fall back to
// Quickwit's dynamic defaults so the selects stay valid.
export function toDynamicMappingForm(dm: DynamicMapping | null): DynamicMappingForm {
	if (!dm) return defaultDynamicMapping();
	return {
		indexed: dm.indexed,
		stored: dm.stored,
		fast: dm.fast,
		tokenizer: (TOKENIZERS as readonly string[]).includes(dm.tokenizer)
			? (dm.tokenizer as Tokenizer)
			: 'raw',
		record: (RECORD_OPTIONS as readonly string[]).includes(dm.record)
			? (dm.record as RecordOption)
			: 'basic',
		expandDots: dm.expandDots
	};
}

export type FieldRow = {
	name: string;
	type: FieldType;
	indexed: boolean;
	stored: boolean;
	fast: boolean;
	tokenizer: Tokenizer;
	record: RecordOption;
	searchDefault: boolean;
	// A bare term only matches a JSON default search field at this path, never below it.
	searchPath: string;
	fieldnorms: boolean;
	expandDots: boolean;
	coerce: boolean;
	inputFormatPresets: string[];
	inputFormatsCustom: string;
	outputFormat: DatetimeOutputFormat;
	fastPrecision: FastPrecision;
	bytesInputFormat: BytesFormat;
	bytesOutputFormat: BytesFormat;
	description: string;
};

type IndexFormState = {
	indexId: string;
	mode: IndexMode;
	timestampField: string;
	fields: FieldRow[];
	retentionEnabled: boolean;
	retentionPeriod: string;
	retentionSchedule: string;
	indexUri: string;
	tagFields: string; // newline-separated
	commitTimeoutSecs: string;
	storeSource: boolean;
	indexFieldPresence: boolean;
	partitionKey: string;
	maxNumPartitions: string; // text input, like commitTimeoutSecs
	dynamic: DynamicMappingForm;
};

// `fast` is preselected on for every field, not the Quickwit default (false).
export function emptyFieldRow(type: FieldType = 'text'): FieldRow {
	return {
		name: '',
		type,
		indexed: true,
		stored: true,
		fast: true,
		tokenizer: type === 'json' ? 'raw' : 'default',
		record: 'basic',
		searchDefault: false,
		searchPath: '',
		fieldnorms: false,
		expandDots: true,
		coerce: true,
		inputFormatPresets: ['rfc3339', 'unix_timestamp'],
		inputFormatsCustom: '',
		outputFormat: 'rfc3339',
		fastPrecision: 'seconds',
		bytesInputFormat: 'base64',
		bytesOutputFormat: 'base64',
		description: ''
	};
}

export function emptyIndexForm(): IndexFormState {
	return {
		indexId: '',
		mode: 'dynamic',
		timestampField: 'timestamp',
		// The backend force-sets fast on whatever field is the timestamp, so the
		// seed value here is irrelevant for it.
		fields: [{ ...emptyFieldRow('datetime'), name: 'timestamp' }],
		retentionEnabled: false,
		retentionPeriod: '',
		retentionSchedule: '',
		indexUri: '',
		tagFields: '',
		commitTimeoutSecs: '',
		storeSource: false,
		indexFieldPresence: false,
		partitionKey: '',
		maxNumPartitions: '',
		dynamic: defaultDynamicMapping()
	};
}

// hand copy of Quickwit's OTEL_LOGS_INDEX_CONFIG
// (quickwit-opentelemetry/src/otlp/logs.rs), the shape OTLP log ingest needs.
// Re-sync on Quickwit upgrades.
export function otelLogsIndexForm(): IndexFormState {
	const row = (name: string, type: FieldType, opts: Partial<FieldRow> = {}): FieldRow => ({
		...emptyFieldRow(type),
		name,
		fast: false,
		...opts
	});
	const nanos: Partial<FieldRow> = {
		inputFormatPresets: ['unix_timestamp'],
		outputFormat: 'unix_timestamp_nanos'
	};
	const keyword: Partial<FieldRow> = { tokenizer: 'raw', fast: true };
	const hex: Partial<FieldRow> = { bytesInputFormat: 'hex', bytesOutputFormat: 'hex' };
	const unindexed: Partial<FieldRow> = { indexed: false };

	return {
		...emptyIndexForm(),
		indexId: 'otel-logs-',
		mode: 'strict',
		timestampField: 'timestamp_nanos',
		commitTimeoutSecs: '5',
		fields: [
			row('timestamp_nanos', 'datetime', {
				...nanos,
				...unindexed,
				fast: true,
				fastPrecision: 'milliseconds'
			}),
			row('observed_timestamp_nanos', 'datetime', nanos),
			row('service_name', 'text', keyword),
			row('severity_text', 'text', keyword),
			row('severity_number', 'u64', { fast: true }),
			row('body', 'json', { tokenizer: 'default', searchDefault: true, searchPath: 'message' }),
			row('attributes', 'json', keyword),
			row('dropped_attributes_count', 'u64', unindexed),
			row('trace_id', 'bytes', hex),
			row('span_id', 'bytes', hex),
			row('trace_flags', 'u64', unindexed),
			row('resource_attributes', 'json', keyword),
			row('resource_dropped_attributes_count', 'u64', unindexed),
			row('scope_name', 'text', unindexed),
			row('scope_version', 'text', unindexed),
			row('scope_attributes', 'json', unindexed),
			row('scope_dropped_attributes_count', 'u64', unindexed)
		]
	};
}

export function fieldToMapping(field: FieldRow): FieldMappingInput {
	const common: {
		name: string;
		indexed: boolean;
		stored: boolean;
		fast: boolean;
		description?: string;
	} = {
		name: field.name.trim(),
		indexed: field.indexed,
		stored: field.stored,
		fast: field.fast
	};
	const description = field.description.trim();
	if (description) common.description = description;

	// Quickwit rejects tokenizer, record and a true fieldnorms on a field that is not indexed.
	const indexing = field.indexed ? { tokenizer: field.tokenizer, record: field.record } : {};

	switch (field.type) {
		case 'text':
			return {
				...common,
				type: 'text',
				...indexing,
				fieldnorms: field.indexed && field.fieldnorms
			};
		case 'json':
			return { ...common, type: 'json', ...indexing, expandDots: field.expandDots };
		case 'datetime': {
			const m: Extract<FieldMappingInput, { type: 'datetime' }> = {
				...common,
				type: 'datetime',
				outputFormat: field.outputFormat,
				fastPrecision: field.fastPrecision
			};
			const formats = [...field.inputFormatPresets, ...lines(field.inputFormatsCustom)];
			if (formats.length) m.inputFormats = formats;
			return m;
		}
		case 'i64':
		case 'u64':
		case 'f64':
			return { ...common, type: field.type, coerce: field.coerce };
		case 'bool':
			return { ...common, type: 'bool' };
		case 'ip':
			return { ...common, type: 'ip' };
		case 'bytes':
			return {
				...common,
				type: 'bytes',
				inputFormat: field.bytesInputFormat,
				outputFormat: field.bytesOutputFormat
			};
	}
}

export function formToCreateInput(form: IndexFormState): CreateIndexInput {
	const input: CreateIndexInput = {
		indexId: form.indexId.trim(),
		mode: form.mode,
		timestampField: form.timestampField,
		fieldMappings: form.fields.map(fieldToMapping),
		storeSource: form.storeSource,
		indexFieldPresence: form.indexFieldPresence
	};

	// Derived from the per-field flag, so a rename/remove/retype can't strand a stale name.
	const searchFields = form.fields
		.filter(
			(f) => (f.type === 'text' || f.type === 'json') && f.searchDefault && f.name.trim() !== ''
		)
		.map((f) => {
			const path = f.searchPath.trim();
			return path ? `${f.name.trim()}.${path}` : f.name.trim();
		});
	if (searchFields.length) input.defaultSearchFields = searchFields;

	const tags = lines(form.tagFields);
	if (tags.length) input.tagFields = tags;

	if (form.indexUri.trim() !== '') input.indexUri = form.indexUri.trim();

	if (form.commitTimeoutSecs.trim() !== '') {
		input.commitTimeoutSecs = Number(form.commitTimeoutSecs);
	}

	if (form.retentionEnabled) {
		input.retention = { period: form.retentionPeriod.trim() };
		if (form.retentionSchedule.trim() !== '') {
			input.retention.schedule = form.retentionSchedule.trim();
		}
	}

	if (form.mode === 'dynamic') input.dynamicMapping = { ...form.dynamic };

	if (form.partitionKey.trim() !== '') {
		input.partitionKey = form.partitionKey.trim();
		if (form.maxNumPartitions.trim() !== '') {
			input.maxNumPartitions = Number(form.maxNumPartitions);
		}
	}

	return input;
}
