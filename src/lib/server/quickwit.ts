import { QuickwitClient } from 'quickwit-js';
import { normalizeQuickwitUrl } from '$lib/utils/query';
import { config } from '$lib/server/config';

let _client: QuickwitClient | null = null;

export function getQuickwitClient(): QuickwitClient {
	if (!_client) {
		_client = new QuickwitClient(normalizeQuickwitUrl(config.quickwitUrl));
	}
	return _client;
}
