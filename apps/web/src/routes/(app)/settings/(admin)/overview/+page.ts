import { getClusterOverview } from '$lib/api/admin';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		return { cluster: await getClusterOverview(), clusterError: null };
	} catch (err) {
		return { cluster: null, clusterError: err instanceof Error ? err.message : String(err) };
	}
};
