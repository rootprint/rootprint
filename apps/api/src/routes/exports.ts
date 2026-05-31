import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import { quickwit } from '../lib/quickwit.js';
import { withIndexConfig, type IndexConfigEnv } from '../middleware/with-index-config.js';
import { ExportLogsQuery } from '../schemas/export.js';
import { preflightExport, streamExport } from '../services/export.service.js';
import { badRequest } from '../utils/http-error.js';
import { IndexIdParams } from '../utils/params.js';

export const exportsRouter = new Hono<IndexConfigEnv>()
	.use('*', withIndexConfig)
	.get('/', vValidator('param', IndexIdParams), vValidator('query', ExportLogsQuery), async (c) => {
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

		const stream = streamExport(quickwit, indexConfig, q);
		const gzipped = stream.pipeThrough(
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
	});
