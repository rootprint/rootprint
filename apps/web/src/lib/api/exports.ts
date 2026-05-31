import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { ExportFormat } from 'api/types';

export type ExportPreflightInput = {
	indexId: string;
	query: string;
	startTs: number;
	endTs: number;
	format: ExportFormat;
};

export type ExportPreflightResult = {
	total: number;
	capped: boolean;
	numHits: number;
};

export async function preflightExport(
	input: ExportPreflightInput,
	signal?: AbortSignal
): Promise<ExportPreflightResult> {
	const res = await client.api.indexes[':indexId'].logs.export.$get(
		{
			param: { indexId: input.indexId },
			query: {
				q: input.query,
				startTs: String(input.startTs),
				endTs: String(input.endTs),
				format: input.format,
				dryRun: 'true'
			}
		},
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Export preflight failed');
	return (await res.json()) as ExportPreflightResult;
}

/**
 * Use with a programmatic `<a download>` click, not fetch — the browser handles the download.
 * Built as a relative path manually because the Hono client's empty base URL breaks $url().
 */
export function buildExportUrl(input: ExportPreflightInput): string {
	const params = new URLSearchParams({
		q: input.query,
		startTs: String(input.startTs),
		endTs: String(input.endTs),
		format: input.format
	});
	return `/api/indexes/${encodeURIComponent(input.indexId)}/logs/export?${params.toString()}`;
}
