import { query, command } from '$app/server';
import {
	searchLogsSchema,
	searchFieldValuesSchema,
	searchLogHistogramSchema
} from '$lib/schemas/logs';
import { requireUser } from '$lib/middleware/auth';
import * as logService from '$lib/server/services/log.service';
import * as indexService from '$lib/server/services/index.service';

export const searchLogs = command(searchLogsSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	return logService.searchLogs(data);
});

export const searchFieldValues = query(searchFieldValuesSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	return logService.searchFieldValues(data);
});

export const searchLogHistogram = command(searchLogHistogramSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	return logService.searchLogHistogram(data);
});
