import { QuickwitClient } from 'quickwit-js';
import { config } from '$lib/server/config';

/**
 * QuickwitClient adds /api/v1 internally, so strip it if present in user-provided URLs.
 */
function normalizeQuickwitUrl(url: string): string {
	return url.replace(/\/api\/v1\/?$/, '');
}

let _client: QuickwitClient | null = null;

export function getQuickwitClient(): QuickwitClient {
	if (!_client) {
		_client = new QuickwitClient(normalizeQuickwitUrl(config.quickwitUrl));
	}
	return _client;
}
