import { QuickwitClient } from 'quickwit-js';

import { config } from '../config.js';

export const quickwit = new QuickwitClient({ endpoint: config.quickwitUrl });

export function quickwitUrl(path: string): string {
	return config.quickwitUrl.replace(/\/+$/, '') + path;
}

const PROBE_PATH = '/api/v1/version';
const PROBE_RETRY = 6;
const PROBE_DELAY_MS = 2000;
const PROBE_TIMEOUT_MS = 5000;

class PermanentProbeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PermanentProbeError';
	}
}

export async function probeQuickwit(): Promise<void> {
	const url = quickwitUrl(PROBE_PATH);
	let lastError: unknown;
	for (let attempt = 1; attempt <= PROBE_RETRY; attempt++) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
			if (res.ok) return;
			// 4xx (except 408 Request Timeout and 429 Too Many Requests) is a permanent
			// configuration error; retrying won't help. Throw immediately with a clearer message.
			if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
				throw new PermanentProbeError(
					`Quickwit at ${url} returned HTTP ${res.status}. Check QUICKWIT_URL — the path may be wrong or the endpoint isn't responding to version probes.`
				);
			}
			lastError = new Error(`Quickwit returned ${res.status}`);
		} catch (err) {
			if (err instanceof PermanentProbeError) {
				throw err;
			}
			lastError = err;
		}
		if (attempt < PROBE_RETRY) {
			await new Promise<void>((r) => setTimeout(r, PROBE_DELAY_MS));
		}
	}
	throw new Error(`Quickwit not reachable at ${url} after ${PROBE_RETRY} attempts`, {
		cause: lastError
	});
}
