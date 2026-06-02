import { Hono } from 'hono';

import { describe, validator } from '../lib/openapi/describe.js';
import { quickwit } from '../lib/quickwit.js';
import { withIndexConfig, type IndexConfigEnv } from '../middleware/with-index-config.js';
import { ExportLogsQuery } from '../schemas/export.js';
import { buildExportBody, preflightExport } from '../services/export.service.js';
import { badRequest } from '../utils/http-error.js';
import { IndexIdParams } from '../utils/params.js';

export const exportsRouter = new Hono<IndexConfigEnv>().use('*', withIndexConfig).get(
	'/',
	describe({
		tag: 'Log explorer',
		summary: 'Export logs',
		description:
			'Export matching log entries as a gzip-compressed file. ' +
			'When dryRun=true, returns a JSON preflight estimate instead of streaming the file.',
		rawResponses: {
			'200': {
				description:
					'Gzip-compressed export stream. Content-Type reflects the requested format ' +
					'(application/x-ndjson for JSON, text/csv for CSV, text/plain for text).',
				content: {
					'application/x-ndjson': {
						schema: { type: 'string', format: 'binary' }
					},
					'text/csv': {
						schema: { type: 'string', format: 'binary' }
					},
					'text/plain': {
						schema: { type: 'string', format: 'binary' }
					}
				},
				headers: {
					'Content-Disposition': {
						schema: { type: 'string' },
						description:
							'Attachment filename, e.g. attachment; filename="rootprint-index-....ndjson.gz"'
					},
					'Content-Encoding': {
						schema: { type: 'string', enum: ['gzip'] }
					}
				}
			}
		}
	}),
	validator('param', IndexIdParams),
	validator('query', ExportLogsQuery),
	async (c) => {
		const q = c.req.valid('query');
		const indexConfig = c.get('indexConfig');

		// dryRun: return the estimate the UI uses to confirm before downloading.
		if (q.dryRun) {
			const result = await preflightExport(quickwit, indexConfig, q);
			return c.json({
				total: result.total,
				capped: result.capped,
				numHits: result.numHits
			});
		}

		const { total, filename, contentType } = await preflightExport(quickwit, indexConfig, q);
		if (total === 0) throw badRequest('No logs match in this time range');

		const body = await buildExportBody(quickwit, indexConfig, q);
		const gzipped = new Response(body as BodyInit).body!.pipeThrough(
			new CompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>
		);

		return new Response(gzipped, {
			headers: {
				'Content-Type': contentType,
				'Content-Encoding': 'gzip',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-store'
			}
		});
	}
);
