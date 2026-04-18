import { error, redirect } from '@sveltejs/kit';

import { assertIndexAccess } from '$lib/server/services/index.service';
import * as sharedLinkService from '$lib/server/services/shared-link.service';
import type { ParsedQuery } from '$lib/types';
import { serialize } from '$lib/utils/query-params';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { code } = event.params;
	const userRole = event.locals.user?.role;

	const link = await sharedLinkService.resolveSharedLink(code);
	if (!link) {
		error(404, 'Shared link not found');
	}

	await assertIndexAccess(link.indexName, userRole);

	// Build the search page URL with stored state
	const parsedQuery: ParsedQuery = {
		index: link.indexName,
		query: link.query,
		timeRange: { type: 'absolute', start: link.startTime, end: link.endTime },
		timezoneMode: 'local',
		sortDirection: 'desc'
	};
	const params = serialize(parsedQuery);
	params.set('share', code);

	redirect(302, `/?${params.toString()}`);
};
