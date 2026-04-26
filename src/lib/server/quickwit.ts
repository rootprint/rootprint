import { QuickwitClient } from 'quickwit-js';

import { config } from '$lib/server/config';

/**
 * QuickwitClient adds /api/v1 internally, so strip it if present in user-provided URLs.
 */
function normalizeQuickwitUrl(url: string): string {
	return url.replace(/\/api\/v1\/?$/, '');
}

export const quickwitClient = new QuickwitClient({
	endpoint: normalizeQuickwitUrl(config.quickwitUrl),
	timeout: config.quickwitTimeoutMs
});
