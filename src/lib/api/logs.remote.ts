import { command, query } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import {
	searchFieldValuesSchema,
	searchLogHistogramSchema,
	searchLogsSchema
} from '$lib/schemas/logs';
import { searchLogStatsSchema } from '$lib/schemas/stats';
import * as indexService from '$lib/server/services/index.service';
import * as logService from '$lib/server/services/log.service';

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

export const searchLogStats = command(searchLogStatsSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	return logService.searchLogStats(data);
});
