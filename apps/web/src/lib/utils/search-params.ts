import { goto } from '$app/navigation';
import { page } from '$app/state';

/**
 * Sets a query-string param on the current URL and navigates. Changing any param
 * other than `offset` resets pagination to the first page.
 */
export function setSearchParam(key: string, val: string): void {
	const url = new URL(page.url);
	url.searchParams.set(key, val);
	if (key !== 'offset') url.searchParams.set('offset', '0');
	goto(url, { replaceState: false, keepFocus: true, noScroll: true });
}
