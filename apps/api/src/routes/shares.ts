import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { isAdmin } from '../lib/auth.js';
import { quickwit } from '../lib/quickwit.js';
import { assertIndexAccess } from '../services/index.service.js';
import { createShare, resolveShare } from '../services/share.service.js';
import { unprocessable } from '../utils/http-error.js';

const SHARE_BODY_LIMIT = 64 * 1024;

const CreateBody = v.pipe(
	v.object({
		indexId: v.pipe(v.string(), v.minLength(1)),
		query: v.string(),
		startTime: v.pipe(v.number(), v.integer(), v.minValue(0)),
		endTime: v.pipe(v.number(), v.integer(), v.minValue(0)),
		hit: v.record(v.string(), v.unknown())
	}),
	v.check((b) => b.endTime >= b.startTime, 'endTime must be >= startTime')
);

const CodeParams = v.object({
	code: v.pipe(v.string(), v.length(10))
});

export const sharesRouter = new Hono<AuthedEnv>();

sharesRouter.post(
	'/',
	bodyLimit({
		maxSize: SHARE_BODY_LIMIT,
		onError: () => {
			throw unprocessable('Share payload exceeds 64KB', 'PAYLOAD_TOO_LARGE');
		}
	}),
	vValidator('json', CreateBody),
	async (c) => {
		const body = c.req.valid('json');
		const session = c.get('session');
		await assertIndexAccess(db, quickwit, body.indexId, isAdmin(session));
		const result = await createShare(db, session.user.id, body);
		return c.json(result, 201);
	}
);

sharesRouter.get('/:code', vValidator('param', CodeParams), async (c) => {
	const { code } = c.req.valid('param');
	const session = c.get('session');
	const row = await resolveShare(db, code);
	await assertIndexAccess(db, quickwit, row.indexId, isAdmin(session));
	return c.json(row);
});
