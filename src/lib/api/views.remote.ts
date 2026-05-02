import { command } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import { deleteViewSchema, saveViewSchema } from '$lib/schemas/views';
import * as viewService from '$lib/server/services/view.service';

export const saveView = command(saveViewSchema, async (data) => {
	const user = requireUser();
	return viewService.saveView(user.id, data);
});

export const deleteView = command(deleteViewSchema, async (data) => {
	const user = requireUser();
	await viewService.deleteView(user.id, data.id, user.role);
});
