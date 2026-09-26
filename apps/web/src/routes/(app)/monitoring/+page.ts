import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// The Services page lived here before it was renamed; keeps old bookmarks working.
export const load: PageLoad = ({ url }) => {
	redirect(307, `/services${url.search}`);
};
