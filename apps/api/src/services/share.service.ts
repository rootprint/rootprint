import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import type { Db } from '../db/index.js';
import { share } from '../db/schema.js';
import type { ShareCreateInput, ShareView } from '../types.js';
import { internal, notFound } from '../utils/http-error.js';

export async function createShare(
	db: Db,
	userId: string,
	input: ShareCreateInput
): Promise<{ code: string }> {
	const code = nanoid(10);
	const [row] = await db
		.insert(share)
		.values({
			code,
			userId,
			indexName: input.indexName,
			query: input.query,
			startTime: input.startTime,
			endTime: input.endTime,
			hit: input.hit
		})
		.returning({ code: share.code });
	if (!row) throw internal('Failed to create share');
	return { code: row.code };
}

export async function resolveShare(db: Db, code: string): Promise<ShareView> {
	const [row] = await db
		.select({
			indexName: share.indexName,
			query: share.query,
			startTime: share.startTime,
			endTime: share.endTime,
			hit: share.hit
		})
		.from(share)
		.where(eq(share.code, code))
		.limit(1);
	if (!row) throw notFound('Share not found', 'SHARE_NOT_FOUND');
	return row;
}
