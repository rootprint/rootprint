import { query, command } from '$app/server';
import {
	getPreferenceSchema,
	saveDisplayFieldsSchema,
	saveQuickFilterFieldsSchema
} from '$lib/schemas/preference';
import { requireUser } from '$lib/middleware/auth';
import * as preferenceService from '$lib/server/services/preference.service';

export const getPreference = query(getPreferenceSchema, async (data) => {
	const user = requireUser();
	return preferenceService.getPreference(user.id, data.indexId);
});

export const saveDisplayFields = command(saveDisplayFieldsSchema, async (data) => {
	const user = requireUser();
	await preferenceService.saveDisplayFields(user.id, data.indexId, data.fields);
});

export const saveQuickFilterFields = command(saveQuickFilterFieldsSchema, async (data) => {
	const user = requireUser();
	await preferenceService.saveQuickFilterFields(user.id, data.indexId, data.fields);
});
