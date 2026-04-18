import { command } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import { getLogContextSchema, getMoreContextSchema } from '$lib/schemas/context';
import * as contextService from '$lib/server/services/context.service';
import * as indexService from '$lib/server/services/index.service';

export const getLogContext = command(getLogContextSchema, async (data) => {
	const user = requireUser();
	await indexService.assertIndexAccess(data.indexId, user.role);
	return contextService.getLogContext(data.indexId, data.log, data.excludedFields);
});

export const getMoreContext = command(getMoreContextSchema, async (data) => {
	const user = requireUser();
	await indexService.assertIndexAccess(data.indexId, user.role);
	return contextService.getMoreContext(
		data.indexId,
		data.log,
		data.excludedFields,
		data.direction,
		data.anchorTs,
		data.offset,
		data.limit
	);
});
