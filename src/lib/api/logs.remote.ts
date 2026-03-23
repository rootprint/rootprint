import { query, command } from '$app/server';
import {
	searchLogsSchema,
	searchFieldValuesSchema,
	searchLogHistogramSchema
} from '$lib/schemas/logs';
import { requireUser } from '$lib/middleware/auth';
import * as logService from '$lib/server/services/log.service';

export const searchLogs = command(searchLogsSchema, async (data) => {
	requireUser();
	return logService.searchLogs(data);
});

export const searchFieldValues = query(searchFieldValuesSchema, async (data) => {
	requireUser();
	return logService.searchFieldValues(data);
});

export const searchLogHistogram = command(searchLogHistogramSchema, async (data) => {
	requireUser();
	return logService.searchLogHistogram(data);
});
