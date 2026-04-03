import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '$lib/server/db';
import { sharedLink } from '$lib/server/db/schema';
import { getQuickwitClient } from '$lib/server/quickwit';
import { extractTimestampSeconds, fingerprint } from '$lib/server/utils/fingerprint';

const SHARE_LINK_TTL_DAYS = 30;
const SHARE_LINK_TTL_MS = SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function createSharedLink(
	userId: string,
	indexName: string,
	query: string,
	startTime: number,
	endTime: number,
	hit: Record<string, unknown>,
	timestampField: string
): Promise<string> {
	const logFingerprint = fingerprint(hit, timestampField);
	const logTimestamp = extractTimestampSeconds(hit, timestampField);

	const MAX_RETRIES = 3;
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const code = nanoid(21);
		try {
			await db.insert(sharedLink).values({
				code,
				userId,
				indexName,
				query,
				startTime,
				endTime,
				logTimestamp,
				logFingerprint
			});
			return code;
		} catch (err: unknown) {
			const isUniqueViolation =
				err instanceof Error && err.message.includes('UNIQUE constraint failed');
			if (!isUniqueViolation || attempt === MAX_RETRIES - 1) throw err;
		}
	}
	throw new Error('Failed to generate unique share code');
}

export async function resolveSharedLink(code: string) {
	const [link] = await db.select().from(sharedLink).where(eq(sharedLink.code, code));
	if (!link) return null;
	if (Date.now() - link.createdAt.getTime() >= SHARE_LINK_TTL_MS) return null;
	return link;
}

export async function findMatchingHit(
	indexName: string,
	logTimestamp: number,
	logFingerprint: string,
	timestampField: string
): Promise<Record<string, unknown> | null> {
	const client = getQuickwitClient();
	const idx = client.index(indexName);
	const PAGE_SIZE = 200;
	const MAX_PAGES = 5;
	let offset = 0;

	for (let page = 0; page < MAX_PAGES; page++) {
		const q = idx.query('*').limit(PAGE_SIZE).offset(offset).sortBy(timestampField, 'asc');
		q.timeRange(logTimestamp, logTimestamp + 1);

		const result = await idx.search(q);

		for (const hit of result.hits) {
			if (fingerprint(hit, timestampField) === logFingerprint) {
				return hit;
			}
		}

		if (result.hits.length < PAGE_SIZE) break;
		offset += result.hits.length;
	}

	return null;
}
