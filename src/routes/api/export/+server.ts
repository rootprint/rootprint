import { json, type RequestHandler } from '@sveltejs/kit';
import { AggregationBuilder } from 'quickwit-js';
import * as v from 'valibot';

import { exportLogsSchema } from '$lib/schemas/export';
import { getQuickwitClient } from '$lib/server/quickwit';
import {
	EXPORT_BATCH_SIZE,
	EXPORT_MAX_LOGS,
	exportManager
} from '$lib/server/services/export.service';
import { assertIndexAccess, getFieldConfig } from '$lib/server/services/index.service';
import { normalizeToMs } from '$lib/utils/time';

function toEpochSeconds(rawTs: unknown): number | null {
	if (typeof rawTs === 'string') {
		const ms = new Date(rawTs).getTime();
		return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
	}
	if (typeof rawTs === 'number') {
		return Math.floor(normalizeToMs(rawTs) / 1000);
	}
	return null;
}

async function runExportJob(
	exportId: string,
	data: v.InferOutput<typeof exportLogsSchema>,
	timestampField: string,
	levelField: string,
	messageField: string
): Promise<void> {
	try {
		const client = getQuickwitClient();
		const index = client.index(data.indexId);

		let currentEnd = data.endTimestamp;
		let totalFetched = 0;

		while (true) {
			if (data.startTimestamp >= currentEnd) break;
			if (totalFetched >= EXPORT_MAX_LOGS) break;

			const remaining = EXPORT_MAX_LOGS - totalFetched;
			const batchLimit = Math.min(EXPORT_BATCH_SIZE, remaining);

			// Adding an aggregation forces quickwit-js to use POST instead of GET.
			// Quickwit's GET search endpoint rejects certain query parameter combinations.
			const query = index
				.query(data.query || '*')
				.limit(batchLimit)
				.offset(0)
				.sortBy(timestampField, 'desc')
				.agg('_export', AggregationBuilder.terms(timestampField, { size: 1 }));

			query.timeRange(data.startTimestamp, currentEnd);

			const result = await index.search(query);
			const hits = result.hits as Record<string, unknown>[];

			if (hits.length === 0) break;

			exportManager.appendLogs(exportId, hits);
			totalFetched += hits.length;

			if (hits.length < batchLimit) break;

			// Last hit is the oldest in this descending batch — retreat end cursor
			const lastHit = hits[hits.length - 1];
			const lastTs = toEpochSeconds(lastHit[timestampField]);
			if (lastTs === null) break;

			currentEnd = lastTs;
		}

		await exportManager.finalize(exportId, timestampField, levelField, messageField);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown export error';
		exportManager.setError(exportId, message);
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Invalid JSON body' }, { status: 400 });
	}

	const parsed = v.safeParse(exportLogsSchema, body);
	if (!parsed.success) {
		return json({ message: 'Invalid request' }, { status: 400 });
	}

	const data = parsed.output;
	assertIndexAccess(data.indexId, locals.user.role);
	const fieldConfig = getFieldConfig(data.indexId);

	const client = getQuickwitClient();
	const index = client.index(data.indexId);

	let total: number;
	try {
		const countQuery = index
			.query(data.query || '*')
			.limit(0)
			.countAll()
			.agg('_count', AggregationBuilder.terms(fieldConfig.timestampField, { size: 1 }));
		countQuery.timeRange(data.startTimestamp, data.endTimestamp);
		const countResult = await index.search(countQuery);
		total = (countResult.num_hits as number) ?? 0;
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Query failed';
		return json({ message }, { status: 400 });
	}

	const timestamp = new Date()
		.toISOString()
		.replace(/\.\d{3}Z$/, 'Z')
		.replace(/:/g, '-');
	const filename = `logwiz-${data.indexId}-${timestamp}.${data.format}.gz`;

	const exportId = exportManager.create({
		format: data.format,
		total,
		filename,
		userId: locals.user.id
	});

	runExportJob(
		exportId,
		data,
		fieldConfig.timestampField,
		fieldConfig.levelField,
		fieldConfig.messageField
	);

	return json({ exportId });
};
