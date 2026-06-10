import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { isAdmin } from '../lib/auth.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { quickwit } from '../lib/quickwit.js';
import { assertIndexAccess } from '../services/index.service.js';
import { createShare, resolveShare } from '../services/share.service.js';
import { ShareCreateResponse, ShareViewResponse } from '../schemas/responses/shares.js';
import { shareCodeParamsSchema, shareCreateSchema } from '../schemas/shares.js';
import { unprocessable } from '../utils/http-error.js';

const SHARE_BODY_LIMIT = 64 * 1024;

export const sharesRouter = new Hono<AuthedEnv>()
	.post(
		'/',
		describe({
			tag: 'Shares',
			summary: 'Create a share link',
			ok: ShareCreateResponse,
			okStatus: 201,
			okDescription: 'Share created'
		}),
		bodyLimit({
			maxSize: SHARE_BODY_LIMIT,
			onError: () => {
				throw unprocessable('Share payload exceeds 64KB', 'PAYLOAD_TOO_LARGE');
			}
		}),
		validator('json', shareCreateSchema),
		async (c) => {
			const body = c.req.valid('json');
			const session = c.get('session');
			await assertIndexAccess(db, quickwit, body.indexId, isAdmin(session));
			const result = await createShare(db, session.user.id, body);
			return c.json(result, 201);
		}
	)
	.get(
		'/:code',
		describe({
			tag: 'Shares',
			summary: 'Resolve a share link',
			ok: ShareViewResponse,
			okDescription: 'Resolved share'
		}),
		validator('param', shareCodeParamsSchema),
		async (c) => {
			const { code } = c.req.valid('param');
			const session = c.get('session');
			const row = await resolveShare(db, code);
			await assertIndexAccess(db, quickwit, row.indexId, isAdmin(session));
			return c.json(row);
		}
	);
