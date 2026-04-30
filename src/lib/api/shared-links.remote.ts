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
		data.hit
	);
	return { code };
});

export const resolveSharedHit = command(resolveSharedHitSchema, async (data) => {
	const user = requireUser();
	const link = await sharedLinkService.resolveSharedLink(data.code);
	if (!link) return { hit: null };

	await indexService.assertIndexAccess(link.indexName, user.role);

	return { hit: link.hit };
});
