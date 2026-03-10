import { QuickwitClient } from 'quickwit-js';
import { env } from '$env/dynamic/private';
import { normalizeQuickwitUrl } from '$lib/utils/query';

let _client: QuickwitClient | null = null;

export function getQuickwitClient(): QuickwitClient {
	if (!_client) {
		if (!env.QUICKWIT_URL) throw new Error('QUICKWIT_URL is not set');
		_client = new QuickwitClient(normalizeQuickwitUrl(env.QUICKWIT_URL));
	}
	return _client;
}
