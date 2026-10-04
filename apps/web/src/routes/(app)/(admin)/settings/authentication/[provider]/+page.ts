import { error } from '@sveltejs/kit';
import { providerById } from '#lib/components/settings/authentication/oauth-providers.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const provider = providerById.get(params.provider);
	if (!provider) error(404, 'Unknown provider');
	return { provider, settings: await provider.load() };
};
