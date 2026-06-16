import { SOURCE_INPUT_FORMATS, FILE_MESSAGE_TYPES, KAFKA_LOG_LEVELS } from 'api/schemas';
import type { CreateSourceInput, UpdateSourceInput } from 'api/schemas';
import type { SourceDetail } from 'api/types';

import { lines } from '$lib/utils/lines';

export type SourceType = 'kinesis' | 'file' | 'kafka' | 'pulsar';
export type InputFormat = (typeof SOURCE_INPUT_FORMATS)[number];
export type MessageType = (typeof FILE_MESSAGE_TYPES)[number];
export type KafkaLogLevel = (typeof KAFKA_LOG_LEVELS)[number];

export const EDITABLE_SOURCE_TYPES = ['kinesis', 'file', 'kafka', 'pulsar'] as const;

export function isEditableSourceType(type: string): type is SourceType {
	return (EDITABLE_SOURCE_TYPES as readonly string[]).includes(type);
}

// Quickwit's built-in sources (`_ingest-api-source`, `_ingest-cli-source`) use
// the `ingest-api` / `ingest-cli` source types and reserve `_`-prefixed IDs.
// They cannot be deleted or disabled, so the UI hides destructive actions.
export function isManagedSource(source: { sourceId: string; sourceType: string }): boolean {
	return (
		source.sourceType === 'ingest-api' ||
		source.sourceType === 'ingest-cli' ||
		source.sourceId.startsWith('_')
	);
}

export type SourceFormState = {
	sourceId: string;
	sourceType: SourceType;
	inputFormat: '' | InputFormat;
	numPipelines: string;
	vrlScript: string;
	// kinesis
	streamName: string;
	awsTarget: 'region' | 'endpoint';
	region: string;
	endpoint: string;
	// file
	queueUrl: string;
	messageType: MessageType;
	// kafka
	topic: string;
	clientLogLevel: '' | KafkaLogLevel;
	clientParamsJson: string;
	enableBackfillMode: boolean;
	// pulsar
	pulsarTopics: string;
	address: string;
	consumerName: string;
};

export function emptySourceForm(): SourceFormState {
	return {
		sourceId: '',
		sourceType: 'kinesis',
		inputFormat: '',
		numPipelines: '',
		vrlScript: '',
		streamName: '',
		awsTarget: 'region',
		region: '',
		endpoint: '',
		queueUrl: '',
		messageType: 's3_notification',
		topic: '',
		clientLogLevel: '',
		clientParamsJson: '',
		enableBackfillMode: false,
		pulsarTopics: '',
		address: '',
		consumerName: ''
	};
}

// Parse the kafka client_params JSON textarea into an object for the API.
// Empty/whitespace -> no params (undefined). Must be a plain JSON object,
// never an array or scalar.
export function parseClientParams(text: string): {
	value?: Record<string, unknown>;
	error?: string;
} {
	const trimmed = text.trim();
	if (trimmed === '') return { value: undefined };
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return { error: 'Client params must be valid JSON.' };
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return { error: 'Client params must be a JSON object.' };
	}
	return { value: parsed as Record<string, unknown> };
}

export function sourceDetailToForm(detail: SourceDetail): SourceFormState {
	const sourceType: SourceType = isEditableSourceType(detail.sourceType)
		? detail.sourceType
		: 'kinesis';
	return {
		sourceId: detail.sourceId,
		sourceType,
		inputFormat: (detail.inputFormat as InputFormat | null) ?? '',
		numPipelines: detail.numPipelines != null ? String(detail.numPipelines) : '',
		vrlScript: detail.vrlScript ?? '',
		streamName: detail.streamName ?? '',
		awsTarget: detail.endpoint ? 'endpoint' : 'region',
		region: detail.region ?? '',
		endpoint: detail.endpoint ?? '',
		queueUrl: detail.queueUrl ?? '',
		messageType: (detail.messageType as MessageType | null) ?? 's3_notification',
		topic: detail.topic ?? '',
		clientLogLevel: (detail.clientLogLevel as KafkaLogLevel | null) ?? '',
		clientParamsJson: detail.clientParams ? JSON.stringify(detail.clientParams, null, 2) : '',
		enableBackfillMode: detail.enableBackfillMode ?? false,
		pulsarTopics: detail.topics ? detail.topics.join('\n') : '',
		address: detail.address ?? '',
		consumerName: detail.consumerName ?? ''
	};
}

function commonFields(form: SourceFormState) {
	const parsedPipelines = Number(form.numPipelines);
	return {
		inputFormat: form.inputFormat === '' ? undefined : form.inputFormat,
		numPipelines:
			form.numPipelines.trim() === '' || !Number.isInteger(parsedPipelines)
				? undefined
				: parsedPipelines,
		vrlScript: form.vrlScript.trim() === '' ? undefined : form.vrlScript
	};
}

// A create input is an update input plus the (immutable) sourceId.
export function formToCreateInput(form: SourceFormState): CreateSourceInput {
	return { sourceId: form.sourceId.trim(), ...formToUpdateInput(form) };
}

export function formToUpdateInput(form: SourceFormState): UpdateSourceInput {
	const common = commonFields(form);
	switch (form.sourceType) {
		case 'kinesis':
			return {
				...common,
				sourceType: 'kinesis',
				streamName: form.streamName.trim(),
				region:
					form.awsTarget === 'region' && form.region.trim() !== '' ? form.region.trim() : undefined,
				endpoint:
					form.awsTarget === 'endpoint' && form.endpoint.trim() !== ''
						? form.endpoint.trim()
						: undefined
			};
		case 'file':
			return {
				...common,
				sourceType: 'file',
				queueUrl: form.queueUrl.trim(),
				messageType: form.messageType
			};
		case 'kafka':
			return {
				...common,
				sourceType: 'kafka',
				topic: form.topic.trim(),
				clientLogLevel: form.clientLogLevel === '' ? undefined : form.clientLogLevel,
				// Callers pre-validate the JSON via parseClientParams and surface its
				// error before reaching here, so invalid input never gets this far.
				clientParams: parseClientParams(form.clientParamsJson).value,
				enableBackfillMode: form.enableBackfillMode
			};
		case 'pulsar':
			return {
				...common,
				sourceType: 'pulsar',
				topics: lines(form.pulsarTopics),
				address: form.address.trim(),
				consumerName: form.consumerName.trim() === '' ? undefined : form.consumerName.trim()
			};
	}
}
