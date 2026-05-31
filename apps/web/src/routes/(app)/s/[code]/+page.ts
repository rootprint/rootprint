import { ApiError } from '$lib/api/errors';
import { getShare, type ShareView } from '$lib/api/shares';
import type { PageLoad } from './$types';

export type ShareError = 'forbidden' | 'not_found' | 'unknown';

export type ShareLoadResult =
	| { share: ShareView; error?: undefined }
	| { share?: undefined; error: ShareError };

export const load: PageLoad = async ({ params }): Promise<ShareLoadResult> => {
	try {
		const share = await getShare(params.code);
		return { share };
	} catch (e) {
		if (e instanceof ApiError) {
			if (e.status === 403) return { error: 'forbidden' };
			if (e.status === 404) return { error: 'not_found' };
		}
		return { error: 'unknown' };
	}
};
