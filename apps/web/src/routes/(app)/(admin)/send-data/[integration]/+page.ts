import { error } from '@sveltejs/kit';
import { listApiKeys } from '$lib/api/api-keys';
import { ApiError } from '$lib/api/errors';
import { listIndexes } from '$lib/api/indexes';
import { integrationById } from '$lib/components/send-data/integrations';
import { DEP } from '$lib/api/deps';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEP.sendTelemetryApiKeys);
	depends(DEP.indexes);

	if (!integrationById.has(params.integration)) {
		error(404, 'Unknown integration');
	}

	try {
		const [apiKeys, indexes] = await Promise.all([listApiKeys(), listIndexes()]);
		const traceIndexId = indexes.find((i) => i.isTraceIndex)?.indexId ?? null;
		// Every guide sends OTLP, and Quickwit drops OTLP logs aimed at a non-OTel index while still
		// answering 200, so keys on custom indexes are neither offered nor creatable here.
		const isOtelLogsIndex = (id: string) => id.startsWith('otel-') && id !== traceIndexId;
		return {
			integrationId: params.integration,
			apiKeys: apiKeys.filter((k) => isOtelLogsIndex(k.indexId)),
			indexes: indexes.filter((i) => isOtelLogsIndex(i.indexId)),
			traceIndexId
		};
	} catch (e) {
		if (e instanceof ApiError) error(e.status, e.message);
		throw e;
	}
};
