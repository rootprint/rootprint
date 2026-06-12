import { DEP } from '$lib/api/deps';
import { authClient } from '$lib/auth-client';
import type { PersonalApiKey } from '$lib/types';
import type { PageLoad } from './$types';

async function loadHasPassword(): Promise<boolean | 'unknown'> {
	try {
		const result = await authClient.listAccounts();
		return (result?.data ?? []).some((a) => a.providerId === 'credential');
	} catch (e) {
		console.warn('[profile] could not determine sign-in method', e);
		return 'unknown';
	}
}

async function loadPersonalKeys(): Promise<PersonalApiKey[] | null> {
	try {
		const result = await authClient.apiKey.list();
		if (result.error) {
			console.warn('[profile] could not load personal API keys', result.error);
			return null;
		}
		return result.data?.apiKeys ?? null;
	} catch (e) {
		console.warn('[profile] could not load personal API keys', e);
		return null;
	}
}

export const load: PageLoad = async ({ depends }) => {
	depends(DEP.personalKeys);
	const [hasPassword, personalKeys] = await Promise.all([loadHasPassword(), loadPersonalKeys()]);
	return { hasPassword, personalKeys };
};
