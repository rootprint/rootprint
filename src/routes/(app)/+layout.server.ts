import { getIndexes } from '$lib/server/services/index.service';

export const load = async () => {
	const indexes = getIndexes();
	return { indexes };
};
