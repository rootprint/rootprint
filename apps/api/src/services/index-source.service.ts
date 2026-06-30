import { NotFoundError, QuickwitError, type QuickwitClient, type SourceConfig } from 'quickwit-js';

import type { IndexSource, QuickwitIndexMetadata, SourceDetail } from '../types.js';
import { conflict, notFound } from '../utils/http-error.js';
import { translateQuickwitError, withNotFound } from '../utils/quickwit-error.js';
import type { CreateSourceInput, UpdateSourceInput } from '../schemas/sources.js';
import { getIndex as qwGetIndex } from './quickwit-index.service.js';

const QUICKWIT_SOURCE_CONFIG_VERSION = '0.9';

export async function setSourceEnabled(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string,
	enabled: boolean
): Promise<void> {
	await withNotFound(() => qw.index(indexId).toggleSource(sourceId, enabled), 'Source not found');
}

export async function deleteSource(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string
): Promise<void> {
	await withNotFound(() => qw.index(indexId).deleteSource(sourceId), 'Source not found');
}

function toSourceConfig(sourceId: string, input: UpdateSourceInput): SourceConfig {
	const base = {
		version: QUICKWIT_SOURCE_CONFIG_VERSION,
		source_id: sourceId,
		source_type: input.sourceType,
		...(input.inputFormat ? { input_format: input.inputFormat } : {}),
		...(input.numPipelines ? { num_pipelines: input.numPipelines } : {}),
		...(input.vrlScript ? { transform: { script: input.vrlScript } } : {})
	};

	switch (input.sourceType) {
		case 'kinesis':
			return {
				...base,
				params: {
					stream_name: input.streamName,
					...(input.region ? { region: input.region } : {}),
					...(input.endpoint ? { endpoint: input.endpoint } : {})
				}
			} as SourceConfig;
		case 'file':
			return {
				...base,
				params: {
					notifications: [
						{ type: 'sqs', queue_url: input.queueUrl, message_type: input.messageType }
					]
				}
			} as SourceConfig;
		case 'kafka':
			return {
				...base,
				params: {
					topic: input.topic,
					...(input.clientLogLevel ? { client_log_level: input.clientLogLevel } : {}),
					...(input.clientParams ? { client_params: input.clientParams } : {}),
					enable_backfill_mode: input.enableBackfillMode ?? false
				}
			} as SourceConfig;
	}
}

export async function createSource(
	qw: QuickwitClient,
	indexId: string,
	input: CreateSourceInput
): Promise<IndexSource> {
	let created: SourceConfig;
	try {
		created = await qw.index(indexId).createSource(toSourceConfig(input.sourceId, input));
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound('Index not found');
		if (err instanceof QuickwitError) {
			const e = err as QuickwitError;
			if (e.status === 409 || /already (exists|used)/i.test(e.message)) {
				throw conflict('A source with this ID already exists.', 'SOURCE_EXISTS', [
					{ path: 'sourceId', message: 'A source with this ID already exists.' }
				]);
			}
		}
		translateQuickwitError(err);
	}

	return {
		sourceId: created.source_id,
		sourceType: created.source_type,
		enabled: created.enabled ?? true
	};
}

const SECRET_MASK = '••••••';
const SECRET_KEY = /password|secret/i;

function redactSecrets(params: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(params)) {
		out[key] = SECRET_KEY.test(key) ? SECRET_MASK : value;
	}
	return out;
}

// Swap masked values back to the stored secret so editing other fields doesn't clobber it.
function restoreSecrets(
	incoming: Record<string, unknown>,
	stored: Record<string, unknown>
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(incoming)) {
		if (value === SECRET_MASK) {
			if (key in stored) out[key] = stored[key];
		} else {
			out[key] = value;
		}
	}
	return out;
}

export function projectSource(index: QuickwitIndexMetadata, sourceId: string): SourceDetail {
	const source = index.sources.find((s) => s.sourceId === sourceId);
	if (!source) throw notFound('Source not found');

	const params = (source.params ?? {}) as Record<string, unknown>;
	const notifications = (params.notifications as Array<Record<string, unknown>> | undefined) ?? [];
	const firstNotification = notifications[0] ?? {};
	const hasUnsupportedConfig =
		notifications.length > 1 || notifications.some((n) => n.type !== 'sqs');

	const clientParams =
		params.client_params != null &&
		typeof params.client_params === 'object' &&
		!Array.isArray(params.client_params)
			? redactSecrets(params.client_params as Record<string, unknown>)
			: null;

	return {
		sourceId: source.sourceId,
		sourceType: source.sourceType,
		enabled: source.enabled,
		inputFormat: source.inputFormat,
		numPipelines: source.numPipelines,
		streamName: typeof params.stream_name === 'string' ? params.stream_name : null,
		region: typeof params.region === 'string' ? params.region : null,
		endpoint: typeof params.endpoint === 'string' ? params.endpoint : null,
		queueUrl: typeof firstNotification.queue_url === 'string' ? firstNotification.queue_url : null,
		messageType:
			typeof firstNotification.message_type === 'string' ? firstNotification.message_type : null,
		topic: typeof params.topic === 'string' ? params.topic : null,
		clientLogLevel: typeof params.client_log_level === 'string' ? params.client_log_level : null,
		clientParams,
		enableBackfillMode:
			typeof params.enable_backfill_mode === 'boolean' ? params.enable_backfill_mode : null,
		vrlScript: source.vrlScript,
		hasUnsupportedConfig
	};
}

async function getRawSourceConfig(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string
): Promise<SourceConfig> {
	const meta = await qw.getIndex(indexId).catch((err: unknown) => {
		if (err instanceof NotFoundError) throw notFound('Index not found');
		throw err;
	});
	const source = (meta.sources ?? []).find((s: SourceConfig) => s.source_id === sourceId);
	if (!source) throw notFound('Source not found');
	return source;
}

function mergeSourceConfig(
	current: SourceConfig,
	sourceId: string,
	input: UpdateSourceInput
): SourceConfig {
	const merged: SourceConfig = {
		...current,
		version: QUICKWIT_SOURCE_CONFIG_VERSION,
		source_id: sourceId,
		source_type: input.sourceType,
		enabled: current.enabled ?? true
	};

	if (input.inputFormat) merged.input_format = input.inputFormat;
	else delete merged.input_format;

	if (input.numPipelines) merged.num_pipelines = input.numPipelines;
	else delete merged.num_pipelines;

	if (input.vrlScript) {
		merged.transform = { ...current.transform, script: input.vrlScript };
	} else {
		delete merged.transform;
	}

	const currentParams = (current.params ?? {}) as Record<string, unknown>;
	switch (input.sourceType) {
		case 'kinesis':
			merged.params = {
				...currentParams,
				stream_name: input.streamName,
				...(input.region ? { region: input.region } : {}),
				...(input.endpoint ? { endpoint: input.endpoint } : {})
			};
			break;
		case 'file':
			merged.params = {
				...currentParams,
				notifications: [{ type: 'sqs', queue_url: input.queueUrl, message_type: input.messageType }]
			};
			break;
		case 'kafka': {
			const storedClientParams =
				currentParams.client_params != null &&
				typeof currentParams.client_params === 'object' &&
				!Array.isArray(currentParams.client_params)
					? (currentParams.client_params as Record<string, unknown>)
					: {};
			const clientParams = input.clientParams
				? restoreSecrets(input.clientParams, storedClientParams)
				: undefined;
			merged.params = {
				topic: input.topic,
				...(input.clientLogLevel ? { client_log_level: input.clientLogLevel } : {}),
				...(clientParams ? { client_params: clientParams } : {}),
				enable_backfill_mode: input.enableBackfillMode ?? false
			};
			break;
		}
	}

	return merged;
}

export async function updateSource(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string,
	input: UpdateSourceInput
): Promise<SourceDetail> {
	const current = await getRawSourceConfig(qw, indexId, sourceId);
	const merged = mergeSourceConfig(current, sourceId, input);
	try {
		await qw.index(indexId).updateSource(sourceId, merged);
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound('Source not found');
		translateQuickwitError(err);
	}
	const index = await qwGetIndex(qw, indexId);
	if (!index) throw notFound('Index not found');
	return projectSource(index, sourceId);
}

export async function resetSourceCheckpoint(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string
): Promise<void> {
	await withNotFound(() => qw.index(indexId).resetSourceCheckpoint(sourceId), 'Source not found');
}
