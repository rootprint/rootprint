import { command } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import {
	clearHistorySchema,
	deleteHistoryEntrySchema,
	recordSearchSchema
} from '$lib/schemas/history';
import * as historyService from '$lib/server/services/history.service';

export const recordSearch = command(recordSearchSchema, async (data) => {
	const user = requireUser();
	return historyService.recordSearch(user.id, data);
});

export const deleteHistoryEntry = command(deleteHistoryEntrySchema, async (data) => {
	const user = requireUser();
	return historyService.deleteHistoryEntry(user.id, data.id);
});

export const clearHistory = command(clearHistorySchema, async (data) => {
	const user = requireUser();
	return historyService.clearHistory(user.id, data.indexId);
});
