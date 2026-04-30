import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '$lib/server/db';
import { sharedLink } from '$lib/server/db/schema';

const SHARE_LINK_TTL_DAYS = 30;
const SHARE_LINK_TTL_MS = SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function createSharedLink(
	userId: string,
	indexName: string,
	query: string,
	startTime: number,
	endTime: number,
	hit: Record<string, unknown>
): Promise<string> {
	const code = nanoid(21);
	await db.insert(sharedLink).values({
		code,
		userId,
		indexName,
		query,
		startTime,
		endTime,
		hit
	});
	return code;
}

export async function resolveSharedLink(code: string) {
	const [link] = await db.select().from(sharedLink).where(eq(sharedLink.code, code));
	if (!link) return null;
	if (Date.now() - link.createdAt.getTime() >= SHARE_LINK_TTL_MS) return null;
	return link;
}
