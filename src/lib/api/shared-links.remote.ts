import { command } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import { createSharedLinkSchema, resolveSharedHitSchema } from '$lib/schemas/shared-link';
import * as indexService from '$lib/server/services/index.service';
import * as sharedLinkService from '$lib/server/services/shared-link.service';

export const createSharedLink = command(createSharedLinkSchema, async (data) => {
	const user = requireUser();
	await indexService.assertIndexAccess(data.indexName, user.role);
	const code = await sharedLinkService.createSharedLink(
		user.id,
		data.indexName,
		data.query,
		data.startTime,
		data.endTime,
		data.hit,
		data.timestampField
	);
	return { code };
});

export const resolveSharedHit = command(resolveSharedHitSchema, async (data) => {
	const user = requireUser();
	const link = await sharedLinkService.resolveSharedLink(data.code);
	if (!link) return { hit: null };

	await indexService.assertIndexAccess(link.indexName, user.role);

	const config = await indexService.getFieldConfig(link.indexName);
	const hit = await sharedLinkService.findMatchingHit(
		link.indexName,
		link.logTimestamp,
		link.logFingerprint,
		config.timestampField
	);
	return { hit };
});
