import { serviceUnavailable } from '../../utils/http-error.js';
import { quickwitUrl } from './client.js';

const METRICS_PATH = '/metrics';
const FETCH_TIMEOUT_MS = 5000;
const MAX_METRICS_BYTES = 16 * 1024 * 1024;

/** Returns Quickwit's Prometheus exposition text. */
export async function fetchQuickwitMetrics(): Promise<string> {
	const url = quickwitUrl(METRICS_PATH);
	let res: Response;
	try {
		res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	} catch {
		throw serviceUnavailable('Quickwit /metrics unreachable', 'QUICKWIT_METRICS_UNAVAILABLE');
	}
	if (!res.ok) {
		throw serviceUnavailable(
			`Quickwit /metrics returned HTTP ${res.status}`,
			'QUICKWIT_METRICS_UNAVAILABLE'
		);
	}
	const declared = Number(res.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > MAX_METRICS_BYTES) {
		throw serviceUnavailable(
			`Quickwit /metrics body too large (${declared} bytes)`,
			'QUICKWIT_METRICS_UNAVAILABLE'
		);
	}
	try {
		return await res.text();
	} catch {
		throw serviceUnavailable('Quickwit /metrics body unreadable', 'QUICKWIT_METRICS_UNAVAILABLE');
	}
}
