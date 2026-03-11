import { env } from '$env/dynamic/private';

export function load() {
	return {
		quickwitUrl: env.QUICKWIT_URL ?? ''
	};
}
