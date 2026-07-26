import { QuickwitClient, QuickwitError } from 'quickwit-js';

import { config } from '../config.js';
import type { QuickwitBuildInfo } from '../types.js';

export const quickwit = new QuickwitClient({ endpoint: config.quickwitUrl });

export function quickwitUrl(path: string): string {
	return quickwit.endpoint + path;
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

function isPermanentProbeStatus(status: number | undefined): boolean {
	return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export async function probeQuickwit(): Promise<void> {
	const url = quickwitUrl(VERSION_PATH);
	let lastError: unknown;
	for (let attempt = 1; attempt <= PROBE_RETRY; attempt++) {
		try {
			await quickwit.getVersion({ timeout: PROBE_TIMEOUT_MS });
			return;
		} catch (err) {
			if (err instanceof QuickwitError && isPermanentProbeStatus(err.status)) {
				throw new PermanentProbeError(
					`Quickwit at ${url} returned HTTP ${err.status}. Check QUICKWIT_URL — the path may be wrong or the endpoint isn't responding to version probes.`
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

function nonEmpty(value: string | undefined): string | null {
	return value && value.length > 0 ? value : null;
}

async function loadQuickwitBuildInfo(): Promise<QuickwitBuildInfo | null> {
	let value: QuickwitBuildInfo | null = null;
	try {
		const { build } = await quickwit.getVersion({ timeout: BUILD_INFO_TIMEOUT_MS });
		const info = {
			version: nonEmpty(build.version),
			commitHash: nonEmpty(build.commit_short_hash) ?? nonEmpty(build.commit_hash),
			buildDate: nonEmpty(build.build_date)
		};
		if (info.version !== null || info.commitHash !== null || info.buildDate !== null) {
			value = info;
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
