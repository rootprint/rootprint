import { SOURCE_INPUT_FORMATS, FILE_MESSAGE_TYPES } from 'api/schemas';
import type { CreateSourceInput, UpdateSourceInput } from 'api/schemas';
import type { SourceDetail } from 'api/types';

export type SourceType = 'kinesis' | 'file';
export type InputFormat = (typeof SOURCE_INPUT_FORMATS)[number];
export type MessageType = (typeof FILE_MESSAGE_TYPES)[number];

// Only these two source types have a real create/edit form in the UI. Any other
// type that already exists on an index (kafka, pulsar, ingest-api, ingest-cli,
// or unknown) is shown read-only.
export const EDITABLE_SOURCE_TYPES = ['kinesis', 'file'] as const;

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
		messageType: 's3_notification'
	};
}

export function sourceDetailToForm(detail: SourceDetail): SourceFormState {
	const sourceType = detail.sourceType === 'file' ? 'file' : 'kinesis';
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
		messageType: (detail.messageType as MessageType | null) ?? 's3_notification'
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

export function formToCreateInput(form: SourceFormState): CreateSourceInput {
	const common = { sourceId: form.sourceId.trim(), ...commonFields(form) };
	if (form.sourceType === 'kinesis') {
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
	}
	return {
		...common,
		sourceType: 'file',
		queueUrl: form.queueUrl.trim(),
		messageType: form.messageType
	};
}

export function formToUpdateInput(form: SourceFormState): UpdateSourceInput {
	const common = commonFields(form);
	if (form.sourceType === 'kinesis') {
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
	}
	return {
		...common,
		sourceType: 'file',
		queueUrl: form.queueUrl.trim(),
		messageType: form.messageType
	};
}
