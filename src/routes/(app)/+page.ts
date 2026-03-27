import { deserialize } from '$lib/utils/query-params';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url, data }) => {
	return {
		...data,
		parsedQuery: deserialize(url.searchParams),
		shareCode: url.searchParams.get('share')
	};
};
