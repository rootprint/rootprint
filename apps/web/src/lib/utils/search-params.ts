import { goto } from '$app/navigation';
import { page } from '$app/state';

export function setSearchParam(
	key: string,
	val: string,
	opts: { resetOffset?: boolean } = {}
): void {
	const { resetOffset = true } = opts;
	const url = new URL(page.url);
	url.searchParams.set(key, val);
	if (resetOffset && key !== 'offset') url.searchParams.set('offset', '0');
	goto(url, { replaceState: false, keepFocus: true, noScroll: true });
}

export function parseOffset(url: URL): number {
	const raw = Number(url.searchParams.get('offset'));
	return Number.isInteger(raw) && raw >= 0 ? raw : 0;
}
