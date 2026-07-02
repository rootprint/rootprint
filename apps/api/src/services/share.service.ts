import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { share } from '../db/schema.js';
import type { ShareCreateInput, ShareView } from '../types.js';
import { internal, notFound } from '../utils/http-error.js';

export async function createShare(
	db: Db,
	userId: string,
	input: ShareCreateInput
): Promise<{ code: string }> {
	// 10 chars to satisfy the share-code param validator (v.length(10)) and match
	// legacy nanoid(10) codes; 10 base64url chars = 60 bits of entropy.
	const code = randomBytes(8).toString('base64url').slice(0, 10);
	const [row] = await db
		.insert(share)
		.values({
			code,
			userId,
			indexId: input.indexId,
			query: input.query,
			startTime: input.startTime,
			endTime: input.endTime,
			hit: input.hit,
			filters: input.filters
		})
		.returning({ code: share.code });
	if (!row) throw internal('Failed to create share');
	return { code: row.code };
}

export async function resolveShare(db: Db, code: string): Promise<ShareView> {
	const [row] = await db
		.select({
			indexId: share.indexId,
			query: share.query,
			startTime: share.startTime,
			endTime: share.endTime,
			hit: share.hit,
			filters: share.filters
		})
		.from(share)
		.where(eq(share.code, code))
		.limit(1);
	if (!row) throw notFound('Share not found', 'SHARE_NOT_FOUND');
	return row;
}
