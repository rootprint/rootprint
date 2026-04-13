import { nanoid } from 'nanoid';

import type { ExportState } from '$lib/types';
import { formatAsCsv, formatAsNdjson, formatAsText } from '$lib/utils/export';

function compress(data: Uint8Array<ArrayBuffer>): Uint8Array {
	return new Uint8Array(Bun.gzipSync(data));
}

export const EXPORT_BATCH_SIZE = 1_000;
export const EXPORT_MAX_LOGS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;
const EXPORT_TTL_MS = 5 * 60_000;

export function _createExportManager() {
	const exports = new Map<string, ExportState>();

	const cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [id, state] of exports) {
			if (now - state.createdAt > EXPORT_TTL_MS) {
				exports.delete(id);
			}
		}
	}, CLEANUP_INTERVAL_MS);

	function create(opts: {
		format: ExportState['format'];
		total: number;
		filename: string;
		userId: string;
	}): string {
		const id = nanoid(12);
		exports.set(id, {
			status: 'pending',
			userId: opts.userId,
			fetched: 0,
			total: Math.min(opts.total, EXPORT_MAX_LOGS),
			format: opts.format,
			logs: [],
			filename: opts.filename,
			createdAt: Date.now()
		});
		return id;
	}

	function get(id: string): ExportState | undefined {
		return exports.get(id);
	}

	function appendLogs(id: string, hits: Record<string, unknown>[]) {
		const state = exports.get(id);
		if (!state) return;

		const remaining = EXPORT_MAX_LOGS - state.logs.length;
		const toAdd = hits.slice(0, remaining);
		state.logs.push(...toAdd);
		state.fetched = state.logs.length;
		state.status = 'fetching';
	}

	async function finalize(
		id: string,
		timestampField: string,
		levelField: string,
		messageField: string
	) {
		const state = exports.get(id);
		if (!state) return;

		state.status = 'compressing';
		state.logs.reverse();

		let content: string;
		switch (state.format) {
			case 'ndjson':
				content = formatAsNdjson(state.logs);
				break;
			case 'csv':
				content = formatAsCsv(state.logs);
				break;
			case 'text':
				content = formatAsText(state.logs, timestampField, levelField, messageField);
				break;
		}

		state.result = compress(new TextEncoder().encode(content));
		state.logs = []; // free memory
		state.status = 'complete';
	}

	function setError(id: string, message: string) {
		const state = exports.get(id);
		if (!state) return;
		state.status = 'error';
		state.error = message;
		state.logs = []; // free memory
	}

	function remove(id: string) {
		exports.delete(id);
	}

	function destroy() {
		clearInterval(cleanupTimer);
		exports.clear();
	}

	return {
		create,
		get,
		appendLogs,
		finalize,
		setError,
		delete: remove,
		destroy
	};
}

export const exportManager = _createExportManager();
