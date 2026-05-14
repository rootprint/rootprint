import { QuickwitClient } from 'quickwit-js';

import { config } from '$lib/server/config';

export const quickwitClient = new QuickwitClient({
	endpoint: config.quickwitUrl,
	timeout: config.quickwitTimeoutMs
});
