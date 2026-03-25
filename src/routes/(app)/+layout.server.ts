import { getIndexes } from '$lib/server/services/index.service';

export const load = async (event) => {
	const indexes = getIndexes(event.locals.user?.role);
	return { indexes };
};
