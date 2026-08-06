import type { Signal, TabItem } from './types';

/** The wizard's signal tabs, in display order. */
export const SIGNAL_TABS: TabItem[] = [
	{ id: 'logs', label: 'Logs' },
	{ id: 'traces', label: 'Traces' }
];

/**
 * The one place the wizard's signal is read from a URL. Anything other than `traces` — a missing
 * param, `?signal=logs`, junk — is the logs wizard, so the explicit and implicit forms never diverge.
 */
export function signalFromUrl(url: URL): Signal {
	return url.searchParams.get('signal') === 'traces' ? 'traces' : 'logs';
}
