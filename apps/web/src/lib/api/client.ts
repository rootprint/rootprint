import { hc } from 'hono/client';
import type { AppType } from 'api';

export const api = hc<AppType>('', {
	fetch: (input: RequestInfo | URL, init?: RequestInit) =>
		fetch(input, { ...init, credentials: 'same-origin' })
});
