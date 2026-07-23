import { QuickwitClient } from 'quickwit-js';
import * as v from 'valibot';

import { config } from '../config.js';
import { quickwitVersionResponseSchema } from '../schemas/quickwit.js';
import type { QuickwitBuildInfo } from '../types.js';

export const quickwit = new QuickwitClient({ endpoint: config.quickwitUrl });

export function quickwitUrl(path: string): string {
	return config.quickwitUrl.replace(/\/+$/, '') + path;
}

const VERSION_PATH = '/api/v1/version';
const PROBE_RETRY = 6;
const PROBE_DELAY_MS = 2000;
const PROBE_TIMEOUT_MS = 5000;
const BUILD_INFO_TIMEOUT_MS = 1000;
const BUILD_INFO_TTL_MS = 60_000;
const BUILD_INFO_FAILURE_TTL_MS = 30_000;

type BuildInfoCacheEntry = {
	value: QuickwitBuildInfo | null;
	expiresAt: number;
};

let buildInfoCache: BuildInfoCacheEntry | null = null;
let buildInfoRequest: Promise<QuickwitBuildInfo | null> | null = null;

class PermanentProbeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PermanentProbeError';
	}
}

export async function probeQuickwit(): Promise<void> {
	const url = quickwitUrl(VERSION_PATH);
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

function nonEmpty(value: string | undefined): string | null {
	return value && value.length > 0 ? value : null;
}

async function loadQuickwitBuildInfo(): Promise<QuickwitBuildInfo | null> {
	let value: QuickwitBuildInfo | null = null;
	try {
		const res = await fetch(quickwitUrl(VERSION_PATH), {
			signal: AbortSignal.timeout(BUILD_INFO_TIMEOUT_MS)
		});
		if (res.ok) {
			const result = v.safeParse(quickwitVersionResponseSchema, await res.json());
			if (result.success) {
				const build = result.output.build;
				const info = {
					version: nonEmpty(build.version),
					commitHash: nonEmpty(build.commit_short_hash) ?? nonEmpty(build.commit_hash),
					buildDate: nonEmpty(build.build_date)
				};
				if (info.version !== null || info.commitHash !== null || info.buildDate !== null) {
					value = info;
				}
			}
		}
	} catch {
		// Build identity is optional; metrics remain usable when this fallback fails.
	}

	buildInfoCache = {
		value,
		expiresAt: Date.now() + (value ? BUILD_INFO_TTL_MS : BUILD_INFO_FAILURE_TTL_MS)
	};
	return value;
}

export async function fetchQuickwitBuildInfo(): Promise<QuickwitBuildInfo | null> {
	if (buildInfoCache && buildInfoCache.expiresAt > Date.now()) return buildInfoCache.value;
	if (buildInfoRequest) return buildInfoRequest;

	buildInfoRequest = loadQuickwitBuildInfo();
	try {
		return await buildInfoRequest;
	} finally {
		buildInfoRequest = null;
	}
}
