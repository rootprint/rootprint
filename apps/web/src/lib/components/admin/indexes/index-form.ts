import {
	DATETIME_OUTPUT_FORMATS,
	FAST_PRECISIONS,
	FIELD_TYPES,
	INDEX_MODES,
	RECORD_OPTIONS,
	TOKENIZERS
} from 'api/schemas';
import type { CreateIndexInput, FieldMappingInput } from 'api/schemas';

import { lines } from '$lib/utils/lines';

export type FieldType = (typeof FIELD_TYPES)[number];
export type Tokenizer = (typeof TOKENIZERS)[number];
export type RecordOption = (typeof RECORD_OPTIONS)[number];
export type IndexMode = (typeof INDEX_MODES)[number];
export type FastPrecision = (typeof FAST_PRECISIONS)[number];
export type DatetimeOutputFormat = (typeof DATETIME_OUTPUT_FORMATS)[number];

export type FieldRow = {
	name: string;
	type: FieldType;
	indexed: boolean;
	stored: boolean;
	fast: boolean;
	tokenizer: Tokenizer;
	record: RecordOption;
	searchDefault: boolean;
	fieldnorms: boolean;
	expandDots: boolean;
	coerce: boolean;
	inputFormatPresets: string[];
	inputFormatsCustom: string;
	outputFormat: DatetimeOutputFormat;
	fastPrecision: FastPrecision;
};

export type IndexFormState = {
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
		fieldnorms: false,
		expandDots: true,
		coerce: true,
		inputFormatPresets: ['rfc3339', 'unix_timestamp'],
		inputFormatsCustom: '',
		outputFormat: 'rfc3339',
		fastPrecision: 'seconds'
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
		indexFieldPresence: false
	};
}

export function fieldToMapping(field: FieldRow): FieldMappingInput {
	const common: { name: string; indexed: boolean; stored: boolean; fast: boolean } = {
		name: field.name.trim(),
		indexed: field.indexed,
		stored: field.stored,
		fast: field.fast
	};

	switch (field.type) {
		case 'text':
			return {
				...common,
				type: 'text',
				tokenizer: field.tokenizer,
				record: field.record,
				fieldnorms: field.fieldnorms
			};
		case 'json':
			return {
				...common,
				type: 'json',
				tokenizer: field.tokenizer,
				record: field.record,
				expandDots: field.expandDots
			};
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
		.map((f) => f.name.trim());
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

	return input;
}
