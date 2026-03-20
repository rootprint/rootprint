import { query } from '$app/server';
import {
	searchLogsSchema,
	searchFieldValuesSchema,
	searchLogHistogramSchema,
	pollLiveLogsSchema
} from '$lib/schemas/logs';
import { requireUser } from '$lib/middleware/auth';
import * as logService from '$lib/server/services/log.service';

export const searchLogs = query(searchLogsSchema, async (data) => {
	requireUser();
	return logService.searchLogs(data);
});

export const searchFieldValues = query(searchFieldValuesSchema, async (data) => {
	requireUser();
	return logService.searchFieldValues(data);
});

export const pollLiveLogs = query(pollLiveLogsSchema, async (data) => {
	requireUser();
	return logService.pollLiveLogs(data);
});

export const searchLogHistogram = query(searchLogHistogramSchema, async (data) => {
	requireUser();
	return logService.searchLogHistogram(data);
});
