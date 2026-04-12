import { command, query } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import { getPreferenceSchema, saveDisplayFieldsSchema } from '$lib/schemas/preference';
import * as preferenceService from '$lib/server/services/preference.service';

export const getPreference = query(getPreferenceSchema, async (data) => {
	const user = requireUser();
	return preferenceService.getPreference(user.id, data.indexId);
});

export const saveDisplayFields = command(saveDisplayFieldsSchema, async (data) => {
	const user = requireUser();
	await preferenceService.saveDisplayFields(user.id, data.indexId, data.fields);
});
