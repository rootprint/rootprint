import type { LayoutLoad } from './$types';
import { listAuthProviders } from '#lib/api/auth.js';

export const load: LayoutLoad = async () => {
	return { providers: await listAuthProviders() };
};
