import { QuickwitClient, QuickwitError } from '@rootprint-io/quickwit-js';
import { tryGetContext } from 'hono/context-storage';

import { config } from '../../config.js';
import type { AppEnv } from '../../env.js';

export const quickwit = new QuickwitClient({ endpoint: config.quickwitUrl });

export function quickwitUrl(path: string): string {
	return quickwit.endpoint + path;
}

export function requestSignal(): AbortSignal | undefined {
	return tryGetContext<AppEnv>()?.req.raw.signal;
}

export function isHangup(err: unknown): boolean {
	const signal = requestSignal();
	return signal?.aborted === true && err === signal.reason;
}

/** Quickwit's search REST API accepts only i64 Unix seconds. */
export function toQuickwitTimestamp(value: number | undefined): number | undefined {
	return value === undefined ? undefined : Math.trunc(value);
}

const VERSION_PATH = '/api/v1/version';
const PROBE_RETRY = 6;
const PROBE_DELAY_MS = 2000;
const PROBE_TIMEOUT_MS = 5000;

function isPermanentProbeStatus(status: number | undefined): boolean {
	return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/** Resolves to the Quickwit version. */
export async function probeQuickwit(): Promise<string | undefined> {
	const url = quickwitUrl(VERSION_PATH);
	let lastError: unknown;
	for (let attempt = 1; attempt <= PROBE_RETRY; attempt++) {
		try {
			return (await quickwit.getVersion({ timeout: PROBE_TIMEOUT_MS })).build?.version;
		} catch (err) {
			if (err instanceof QuickwitError && isPermanentProbeStatus(err.status)) {
				throw new Error(
					`Quickwit at ${url} returned HTTP ${err.status}. Check QUICKWIT_URL — the path may be wrong or the endpoint isn't responding to version probes.`,
					{ cause: err }
				);
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
