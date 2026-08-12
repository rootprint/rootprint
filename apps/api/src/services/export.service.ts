import type { ExportPreflightResult, IndexConfig } from '../types.js';

import { type QuickwitClient } from 'quickwit-js';

import { EXPORT_MAX_ROWS } from '../constants.js';
import { toQuickwitTimestamp } from '../lib/quickwit.js';
import type { ExportLogsQueryInput } from '../schemas/export.js';

const NEWLINE = '\n';
const TEXT_ENCODER = new TextEncoder();

export function formatNdjsonBatch(rows: Record<string, unknown>[]): Uint8Array {
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

export function formatCsvBatch(rows: Record<string, unknown>[]): Uint8Array {
	const header = buildCsvHeader(rows);
	let out = CSV_BOM + header.map(escapeCsvCell).join(',') + NEWLINE;
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

function formatBatch(
	hits: Record<string, unknown>[],
	cfg: IndexConfig,
	format: 'json' | 'csv' | 'text'
): Uint8Array {
	switch (format) {
		case 'json':
			return formatNdjsonBatch(hits);
		case 'csv':
			return formatCsvBatch(hits);
		case 'text':
			return formatTextBatch(hits, cfg);
	}
}

export async function buildExportBody(
	qw: QuickwitClient,
	indexConfig: IndexConfig,
	q: ExportLogsQueryInput
): Promise<{ body: Uint8Array; total: number; filename: string; contentType: string }> {
	const idx = qw.index(indexConfig.indexId);

	const hits = await idx.searchHits(
		idx
			.query(q.q || '*')
			.limit(EXPORT_MAX_ROWS)
			.sortBy(indexConfig.timestampField, 'asc')
			.timeRange(toQuickwitTimestamp(q.startTs), toQuickwitTimestamp(q.endTs))
	);

	return {
		body: formatBatch(hits, indexConfig, q.format),
		total: hits.length,
		filename: buildFilename(indexConfig.indexId, q.format),
		contentType: pickContentType(q.format)
	};
}

export async function preflightExport(
	qw: QuickwitClient,
	indexConfig: IndexConfig,
	q: ExportLogsQueryInput
): Promise<ExportPreflightResult> {
	const idx = qw.index(indexConfig.indexId);
	const numHits = await idx.count(
		idx.query(q.q || '*').timeRange(toQuickwitTimestamp(q.startTs), toQuickwitTimestamp(q.endTs))
	);
	return {
		total: Math.min(numHits, EXPORT_MAX_ROWS),
		capped: numHits > EXPORT_MAX_ROWS,
		numHits
	};
}
