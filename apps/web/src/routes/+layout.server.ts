import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { user, session } = event.locals;
	return { user: user ?? null, session: session ?? null };
};
