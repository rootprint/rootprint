import type { PageLoad } from './$types';
import { listAuthProviders } from '$lib/api/auth';

export const load: PageLoad = async () => ({ providers: await listAuthProviders() });
