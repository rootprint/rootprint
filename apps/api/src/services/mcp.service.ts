import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { QuickwitError } from '@rootprint-io/quickwit-js';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

import { config } from '../config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { quickwit } from '../lib/quickwit/client.js';
import { quickwitErrorToHttp } from '../lib/quickwit/errors.js';
import {
	FieldValuesInput,
	GetIndexFieldsInput,
	GetTraceInput,
	ListIndexesInput,
	LogHistogramInput,
	SearchLogsInput,
	SearchSpansInput
} from '../schemas/mcp.js';
import { intervalSeconds, MAX_BUCKETS, MAX_RANGE_SECONDS } from '../schemas/services.js';
import { hasBalancedParens, type ExploreSpansInput } from '../schemas/traces.js';
import { badRequest, HttpError, isPublicError } from '../utils/http-error.js';
import { isoTimestampString } from '../utils/valibot.js';
import {
	getIndexConfig,
	getIndexMeta,
	getIndexViewConfig,
	listIndexes,
	listIndexFields
} from './index.service.js';
import { fieldValuesBulk, histogramLogs, searchLogs } from './log.service.js';
import { auditActor, withSearchAudit } from './search-audit.service.js';
import { exploreQuery, getExploreSpans } from './trace-explore.service.js';
import { getTrace } from './trace.service.js';

export type McpContext = { userId: string; apiKeyId?: string; requestId: string };

const MAX_STRING_CHARS = 2_000;
// Claude Code drops MCP results over ~25k tokens; an error that says how to narrow beats a lost call.
const MAX_OUTPUT_CHARS = 80_000;
const TARGET_BUCKETS = 60;
const AUTO_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '3h', '6h', '12h', '1d', '7d'];
const TIME_FORMAT = 'must be ISO 8601 with a timezone (2026-10-06T14:30:00Z) or now-<n>[smhd]';
// The immortal flagd traces carry ~1,000 spans; capping keeps one trace from filling the context.
const MAX_TOOL_SPANS = 200;
// Error detail is the bulky part, and a few examples show what failed.
const MAX_DETAILED_ERRORS = 5;

/** Tool output lands in the agent's context window, so one stack trace must not fill it. */
function truncateString(_key: string, value: unknown): unknown {
	if (typeof value !== 'string') return value;
	const extra = value.length - MAX_STRING_CHARS;
	return extra > 0 ? `${value.slice(0, MAX_STRING_CHARS)}…[truncated ${extra} chars]` : value;
}

/**
 * The SDK turns a thrown error into a tool result carrying its raw message, which would bypass
 * app.onError's masking, so every handler runs through here and applies the same rule.
 */
async function runTool(
	ctx: McpContext,
	tool: string,
	run: () => Promise<unknown>
): Promise<CallToolResult> {
	try {
		const text = JSON.stringify(await run(), truncateString);
		if (text.length > MAX_OUTPUT_CHARS) {
			return {
				content: [
					{
						type: 'text',
						text: `Result is ${text.length} characters, over the ${MAX_OUTPUT_CHARS} an agent can take in. Narrow the time range or query, or lower limit.`
					}
				],
				isError: true
			};
		}
		return { content: [{ type: 'text', text }] };
	} catch (raw) {
		const err = raw instanceof QuickwitError ? quickwitErrorToHttp(raw) : raw;
		if (err instanceof HttpError && isPublicError(err)) {
			return { content: [{ type: 'text', text: err.message }], isError: true };
		}
		logger.error({ err: raw, requestId: ctx.requestId, tool }, 'mcp tool failed');
		return { content: [{ type: 'text', text: 'Internal server error' }], isError: true };
	}
}

/** ISO 8601 with a timezone, `now`, or `now-<n><s|m|h|d>` as epoch ms; null otherwise. */
function parseTime(value: string, nowMs: number): number | null {
	const relative = /^now(?:-([1-9]\d*[smhd]))?$/.exec(value);
	if (relative) return nowMs - (relative[1] ? intervalSeconds(relative[1]) * 1000 : 0);
	// Date.parse alone takes "1" as the year 2000 and "10/06/2026" as US-ordered server-local time.
	if (!v.is(isoTimestampString, value)) return null;
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : ms;
}

// Agents get epoch arithmetic wrong, so tools take readable times and convert them here.
function timeRange(
	start: string,
	end: string
): { startTs: number; endTs: number; rangeSeconds: number } {
	const nowMs = Date.now();
	const startMs = parseTime(start, nowMs);
	const endMs = parseTime(end, nowMs);
	if (startMs === null) throw badRequest(`start ${TIME_FORMAT}`);
	if (endMs === null) throw badRequest(`end ${TIME_FORMAT}`);
	if (startMs >= endMs) throw badRequest('start must be before end');
	return {
		startTs: Math.floor(startMs / 1000),
		endTs: Math.ceil(endMs / 1000),
		rangeSeconds: (endMs - startMs) / 1000
	};
}

// Agents pick bad intervals (1s over a week overflows Quickwit's request-wide bucket limit), so an
// absent one auto-sizes to about 60 buckets and an explicit one is capped like the REST routes.
function histogramInterval(requested: string | undefined, rangeSeconds: number): string {
	const interval =
		requested ??
		AUTO_INTERVALS.find((i) => rangeSeconds / intervalSeconds(i) <= TARGET_BUCKETS) ??
		'7d';
	if (rangeSeconds / intervalSeconds(interval) > MAX_BUCKETS) {
		throw badRequest('interval produces too many buckets; use a wider interval or a shorter range');
	}
	return interval;
}

export function buildMcpServer(ctx: McpContext): McpServer {
	const server = new McpServer({ name: 'rootprint', version: '1.0.0' });
	const actor = auditActor(ctx.userId, ctx.apiKeyId);

	server.registerTool(
		'list_indexes',
		{
			description:
				'List the indexes you can search. Log tools take an indexId from here. The entry with isTraceIndex: true is the span store: query it with search_spans and get_trace, not the log tools.',
			annotations: { readOnlyHint: true },
			inputSchema: toStandardJsonSchema(ListIndexesInput)
		},
		() => runTool(ctx, 'list_indexes', () => listIndexes(db, quickwit))
	);

	server.registerTool(
		'get_index_fields',
		{
			description:
				'Fields seen in an index during a time window, with their type and whether they can be aggregated (fast), plus which fields hold the timestamp, log level, message and trace ID. Call this before writing a query so you use real field names. Also works on the span store, to learn span field names for search_spans.',
			annotations: { readOnlyHint: true },
			inputSchema: toStandardJsonSchema(GetIndexFieldsInput)
		},
		({ indexId, start, end }) =>
			runTool(ctx, 'get_index_fields', async () => {
				const range = timeRange(start, end);
				const meta = await getIndexMeta(db, quickwit, indexId);
				const view = getIndexViewConfig(meta);
				const { fields } = await listIndexFields(meta, range);
				return {
					timestampField: view.timestampField,
					levelField: view.levelField,
					messageField: view.messageField,
					traceIdField: view.traceIdField,
					fields: fields.map(({ name, type, fast }) => ({ name, type, fast }))
				};
			})
	);

	server.registerTool(
		'search_logs',
		{
			description: [
				'Search the logs of one index, newest first by default. Returns totalHits (all matches in the window) and up to `limit` hits; strings over 2,000 characters are truncated.',
				'Query syntax (Quickwit, Lucene-like): field:value, field:"exact phrase", AND / OR / NOT, parentheses, ranges field:[400 TO 499] or field:>=500, prefix field:abc*, presence field:*, any of field:IN [a b c]. Fields like service names and log levels are usually exact-match and case-sensitive: check real values with field_values. Phrase queries fail on fields indexed without positions; combine terms with AND instead. Omit query to match everything. Call get_index_fields first for real field names.',
				"To read the first errors of an incident, find its start with log_histogram, then search that window with sort: asc. To find a trace's logs, query the index's traceIdField with the trace ID."
			].join('\n\n'),
			annotations: { readOnlyHint: true },
			inputSchema: toStandardJsonSchema(SearchLogsInput)
		},
		({ indexId, query, start, end, limit, sort }) =>
			runTool(ctx, 'search_logs', async () => {
				const { startTs, endTs } = timeRange(start, end);
				const indexConfig = await getIndexConfig(db, quickwit, indexId);
				const result = await withSearchAudit(
					db,
					actor,
					indexId,
					{ query: query ?? '', startTs, endTs },
					() =>
						searchLogs(quickwit, indexConfig, {
							q: query,
							limit,
							sortOrder: sort,
							startTs,
							endTs,
							countAll: true
						}),
					(r) => r.numHits
				);
				return { totalHits: result.numHits, returned: result.hits.length, hits: result.hits };
			})
	);

	server.registerTool(
		'log_histogram',
		{
			description:
				'Count logs over time, split by log level. Use it to find when a problem started or spiked before reading raw logs: a few hundred tokens instead of thousands of hits. Then search_logs that window with sort: asc to read the first errors. The interval is picked for about 60 buckets unless you pass one.',
			annotations: { readOnlyHint: true },
			inputSchema: toStandardJsonSchema(LogHistogramInput)
		},
		({ indexId, query, start, end, interval }) =>
			runTool(ctx, 'log_histogram', async () => {
				const { startTs, endTs } = timeRange(start, end);
				const chosen = histogramInterval(interval, endTs - startTs);
				const indexConfig = await getIndexConfig(db, quickwit, indexId);
				const { buckets } = await histogramLogs(quickwit, indexConfig, {
					query,
					startTs,
					endTs,
					interval: chosen
				});
				return {
					interval: chosen,
					buckets: buckets.map((b) => ({
						t: new Date(b.key).toISOString(),
						total: b.docCount,
						levels: b.levels
					}))
				};
			})
	);

	server.registerTool(
		'field_values',
		{
			description:
				'Top values with counts for up to 10 fields at once, within a query and time window. Use it to see which service, host, endpoint or version dominates the matching logs, to learn the exact casing of a value before querying it, or to compare before and after a spike.',
			annotations: { readOnlyHint: true },
			inputSchema: toStandardJsonSchema(FieldValuesInput)
		},
		({ indexId, fields, query, start, end, limit }) =>
			runTool(ctx, 'field_values', async () => {
				const { startTs, endTs } = timeRange(start, end);
				const indexConfig = await getIndexConfig(db, quickwit, indexId);
				const { values, truncated } = await fieldValuesBulk(quickwit, indexConfig, {
					fields,
					query,
					startTs,
					endTs,
					limit
				});
				return Object.fromEntries(
					Object.entries(values).map(([field, top]) => [
						field,
						{ values: top, truncated: truncated[field] }
					])
				);
			})
	);

	server.registerTool(
		'search_spans',
		{
			description:
				'Search spans in the span store. Filter by service, operation (span name), status, duration (minMs/maxMs), root spans only, or a free Quickwit query on span fields (get_index_fields on the span store lists them). sort: -duration returns the slowest spans first; status: error returns failing spans. Follow a traceId with get_trace. Time range is at most 30 days.',
			annotations: { readOnlyHint: true },
			inputSchema: toStandardJsonSchema(SearchSpansInput)
		},
		({ query, start, end, ...filters }) =>
			runTool(ctx, 'search_spans', async () => {
				const { startTs, endTs, rangeSeconds } = timeRange(start, end);
				if (rangeSeconds > MAX_RANGE_SECONDS) {
					throw badRequest('Trace range cannot exceed 30 days');
				}
				if (
					filters.minMs !== undefined &&
					filters.maxMs !== undefined &&
					filters.minMs >= filters.maxMs
				) {
					throw badRequest('minMs must be below maxMs');
				}
				if (query !== undefined && !hasBalancedParens(query)) {
					throw badRequest('Query has unbalanced parentheses or quotes');
				}
				const params: ExploreSpansInput = { ...filters, q: query, startTs, endTs, offset: 0 };
				const { rows, total } = await withSearchAudit(
					db,
					actor,
					config.traceIndexId,
					{ query: exploreQuery(params), startTs, endTs },
					() => getExploreSpans(quickwit, config.traceIndexId, params),
					(r) => r.total
				);
				return {
					total,
					spans: rows.map((row) => ({
						traceId: row.traceId,
						spanId: row.spanId,
						service: row.service,
						operation: row.operation,
						start: new Date(row.startMs).toISOString(),
						durationMs: row.durationMicros / 1000,
						isError: row.isError,
						httpStatus: row.httpStatus
					}))
				};
			})
	);

	server.registerTool(
		'get_trace',
		{
			description: `All spans of one trace in start order, timed in ms from the trace start. At most ${MAX_TOOL_SPANS} spans are returned (truncated says when some are missing), and only the first ${MAX_DETAILED_ERRORS} error spans carry attributes and events. To find this trace's logs, call search_logs with query <traceIdField>:<traceId>, taking traceIdField from get_index_fields.`,
			annotations: { readOnlyHint: true },
			inputSchema: toStandardJsonSchema(GetTraceInput)
		},
		({ traceId }) =>
			runTool(ctx, 'get_trace', async () => {
				const trace = await withSearchAudit(
					db,
					actor,
					config.traceIndexId,
					{ query: `trace_id:${traceId}` },
					() => getTrace(quickwit, config.traceIndexId, traceId),
					(r) => r.spans.length
				);
				const spans = trace.spans.slice(0, MAX_TOOL_SPANS);
				const detailed = new Set(spans.filter((s) => s.isError).slice(0, MAX_DETAILED_ERRORS));
				return {
					start:
						trace.spans.length > 0 ? new Date(trace.traceStartMicros / 1000).toISOString() : null,
					spanCount: trace.spans.length,
					truncated: trace.truncated || trace.spans.length > MAX_TOOL_SPANS,
					spans: spans.map((s) => ({
						spanId: s.spanId,
						parentSpanId: s.parentSpanId,
						name: s.name,
						service: s.serviceName,
						startMs: s.startOffsetMicros / 1000,
						durationMs: s.durationMicros / 1000,
						isError: s.isError,
						// Undefined keys drop out of the JSON, so only the detailed error spans carry them.
						attributes: detailed.has(s) ? s.attributes : undefined,
						events: detailed.has(s) ? s.events : undefined
					}))
				};
			})
	);

	return server;
}
