import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// The per-user activity view moved into the unified user profile page.
// Preserve query params (window/offset) so existing links keep working.
export const load: PageLoad = ({ params, url }) => {
	throw redirect(307, `/settings/users/${params.userId}${url.search}`);
};
