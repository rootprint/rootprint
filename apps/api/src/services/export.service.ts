import type { IndexConfig } from './index.service.js';

import { type QuickwitClient } from 'quickwit-js';

import { EXPORT_MAX_ROWS } from '../constants/export.js';
import type { ExportLogsQueryInput } from '../schemas/export.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';

const NEWLINE = '\n';
const TEXT_ENCODER = new TextEncoder();

export type FormatState = {
	csvHeader?: string[];
	preambleEmitted: boolean;
};

export function createFormatState(): FormatState {
	return { preambleEmitted: false };
}

export function formatNdjsonBatch(rows: Record<string, unknown>[]): Uint8Array {
	if (rows.length === 0) return new Uint8Array(0);
	let out = '';
	for (const row of rows) {
		out += JSON.stringify(row) + NEWLINE;
	}
	return TEXT_ENCODER.encode(out);
}

const TEXT_FIELDS_TO_EXCLUDE = (cfg: IndexConfig): Set<string> =>
	new Set([cfg.timestampField, cfg.levelField, cfg.messageField]);

function formatScalar(v: unknown): string {
	if (v === null || v === undefined) return '';
	if (typeof v === 'string') return v;
	if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
	try {
		return JSON.stringify(v);
	} catch {
		return String(v);
	}
}

export function formatTextBatch(rows: Record<string, unknown>[], cfg: IndexConfig): Uint8Array {
	if (rows.length === 0) return new Uint8Array(0);
	const exclude = TEXT_FIELDS_TO_EXCLUDE(cfg);
	let out = '';
	for (const row of rows) {
		const ts = formatScalar(row[cfg.timestampField]);
		const level = formatScalar(row[cfg.levelField] ?? 'unknown');
		const message = formatScalar(row[cfg.messageField]);

		const extras: string[] = [];
		for (const [k, v] of Object.entries(row)) {
			if (exclude.has(k)) continue;
			extras.push(`${k}=${formatScalar(v)}`);
		}

		const parts: string[] = [ts, `[${level}]`];
		if (extras.length > 0) parts.push(extras.join(' '));
		parts.push(message);
		out += parts.join(' ') + NEWLINE;
	}
	return TEXT_ENCODER.encode(out);
}

const CSV_BOM = '﻿';
const CSV_PRIORITY_FIELDS = ['timestamp', 'level', 'message'];
const CSV_QUOTE_RE = /["\n\r,]/;
const CSV_FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

function escapeCsvCell(value: string): string {
	if (CSV_FORMULA_PREFIX_RE.test(value)) {
		return `"'${value.replaceAll('"', '""')}"`;
	}
	if (CSV_QUOTE_RE.test(value)) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}

function buildCsvHeader(rows: Record<string, unknown>[]): string[] {
	const fieldSet = new Set<string>();
	for (const row of rows) {
		for (const key of Object.keys(row)) {
			fieldSet.add(key);
		}
	}
	const priorityPresent = CSV_PRIORITY_FIELDS.filter((f) => fieldSet.has(f));
	const rest = [...fieldSet].filter((f) => !CSV_PRIORITY_FIELDS.includes(f)).toSorted();
	return [...priorityPresent, ...rest];
}

export function formatCsvBatch(rows: Record<string, unknown>[], state: FormatState): Uint8Array {
	if (rows.length === 0 && state.preambleEmitted) return new Uint8Array(0);

	let out = '';
	if (!state.preambleEmitted) {
		state.csvHeader = buildCsvHeader(rows);
		out += CSV_BOM;
		out += state.csvHeader.map(escapeCsvCell).join(',') + NEWLINE;
		state.preambleEmitted = true;
	}
	const header = state.csvHeader!;
	for (const row of rows) {
		const cells = header.map((col) => escapeCsvCell(formatScalar(row[col])));
		out += cells.join(',') + NEWLINE;
	}
	return TEXT_ENCODER.encode(out);
}

function pickContentType(format: 'json' | 'csv' | 'text'): string {
	switch (format) {
		case 'json':
			return 'application/x-ndjson';
		case 'csv':
			return 'text/csv; charset=utf-8';
		case 'text':
			return 'text/plain; charset=utf-8';
	}
}

function pickExtension(format: 'json' | 'csv' | 'text'): string {
	return format === 'text' ? 'txt' : format;
}

function buildFilename(indexId: string, format: 'json' | 'csv' | 'text'): string {
	const safe = indexId.replace(/[^a-zA-Z0-9_.-]/g, '_');
	const stamp = new Date()
		.toISOString()
		.replace(/\.\d{3}Z$/, 'Z')
		.replace(/:/g, '-');
	return `rootprint-${safe}-${stamp}.${pickExtension(format)}`;
}

export type ExportPreflightResult = {
	total: number;
	capped: boolean;
	numHits: number;
	filename: string;
	contentType: string;
};

export function streamExport(
	qw: QuickwitClient,
	indexConfig: IndexConfig,
	q: ExportLogsQueryInput
): ReadableStream<Uint8Array> {
	const idx = qw.index(indexConfig.indexId);
	const state = createFormatState();

	let cancelled = false;
	let done = false;

	function formatBatch(rows: Record<string, unknown>[]): Uint8Array {
		switch (q.format) {
			case 'json':
				return formatNdjsonBatch(rows);
			case 'csv':
				return formatCsvBatch(rows, state);
			case 'text':
				return formatTextBatch(rows, indexConfig);
		}
	}

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (cancelled || done) {
				controller.close();
				return;
			}

			try {
				const builder = idx
					.query(q.q || '*')
					.limit(EXPORT_MAX_ROWS)
					.sortBy(indexConfig.timestampField, 'asc');
				builder.startTimestamp(q.startTs);
				builder.endTimestamp(q.endTs);

				const response = await idx.search(builder).catch(translateQuickwitError);
				const hits = (response.hits ?? []) as Record<string, unknown>[];

				if (hits.length > 0) {
					const bytes = formatBatch(hits);
					if (bytes.byteLength > 0) controller.enqueue(bytes);
				}
				done = true;
				controller.close();
			} catch (e) {
				console.error('[export] stream error:', e);
				controller.error(e);
			}
		},
		cancel() {
			cancelled = true;
		}
	});
}

export async function preflightExport(
	qw: QuickwitClient,
	indexConfig: IndexConfig,
	q: ExportLogsQueryInput
): Promise<ExportPreflightResult> {
	const idx = qw.index(indexConfig.indexId);
	const builder = idx
		.query(q.q || '*')
		.limit(0)
		.countAll();
	builder.startTimestamp(q.startTs);
	builder.endTimestamp(q.endTs);
	const response = await idx.search(builder).catch(translateQuickwitError);
	const numHits = response.num_hits ?? 0;
	const total = Math.min(numHits, EXPORT_MAX_ROWS);
	const capped = numHits > EXPORT_MAX_ROWS;
	return {
		total,
		capped,
		numHits,
		filename: buildFilename(indexConfig.indexId, q.format),
		contentType: pickContentType(q.format)
	};
}
