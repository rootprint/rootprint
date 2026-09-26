import type { LayoutLoad } from './$types';
import { listAuthProviders } from '$lib/api/auth';

export const load: LayoutLoad = async () => {
	return { providers: await listAuthProviders() };
};
