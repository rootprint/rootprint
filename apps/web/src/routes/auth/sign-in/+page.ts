import type { PageLoad } from './$types';
import { listAuthProviders } from '$lib/api/auth';

export const load: PageLoad = async () => {
  const providers = await listAuthProviders();
  return { providers };
};
