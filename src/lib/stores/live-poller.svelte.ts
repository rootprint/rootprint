import { pollLiveLogs } from '$lib/api/logs.remote';
import { toast } from 'svelte-sonner';
import { getErrorMessage } from '$lib/utils/error';

interface LivePollerConfig {
	getIndex: () => string | null;
	getQueryText: () => string;
	getCommitBufferSecs: () => number;
	onNewLogs: (hits: Record<string, unknown>[]) => void;
	onStart: (timestamps: { startTimestamp: number; endTimestamp: number }) => void;
}

export function createLivePoller(config: LivePollerConfig) {
	let isLive = $state(false);
	let newLiveLogs = $state(0);
	let liveIntervalId: ReturnType<typeof setTimeout> | null = null;
	let liveStartedAt = 0;
	let liveSessionId = 0;
	let liveErrorShown = false;
	let lastPollKeys = new Set<string>();

	function docKey(doc: Record<string, unknown>): string {
		return JSON.stringify(doc);
	}

	function isActiveLiveSession(sessionId: number): boolean {
		return isLive && sessionId === liveSessionId;
	}

	function stop() {
		liveSessionId += 1;
		isLive = false;
		newLiveLogs = 0;
		liveErrorShown = false;
		lastPollKeys = new Set();
		if (liveIntervalId !== null) {
			clearTimeout(liveIntervalId);
			liveIntervalId = null;
		}
	}

	function resetNewLiveLogs() {
		newLiveLogs = 0;
	}

	async function pollForNewLogs(sessionId: number) {
		const index = config.getIndex();
		if (!index || !isActiveLiveSession(sessionId)) return;

		const endTs = Math.floor(Date.now() / 1000);
		const startTs = Math.max(liveStartedAt, endTs - config.getCommitBufferSecs());

		if (startTs >= endTs) return;

		try {
			const queryText = config.getQueryText();
			const result = await pollLiveLogs({
				indexId: index,
				query: queryText || '*',
				startTimestamp: startTs,
				endTimestamp: endTs,
				limit: 100
			});

			if (!isActiveLiveSession(sessionId)) return;

			const newHits = result.hits.filter(
				(hit: Record<string, unknown>) => !lastPollKeys.has(docKey(hit))
			);

			lastPollKeys = new Set(result.hits.map((hit: Record<string, unknown>) => docKey(hit)));

			if (newHits.length > 0) {
				config.onNewLogs(newHits);
				newLiveLogs += newHits.length;
			}

			if (liveErrorShown) {
				toast.success('Live mode reconnected');
				liveErrorShown = false;
			}
		} catch (e) {
			if (!isActiveLiveSession(sessionId)) return;
			if (!liveErrorShown) {
				toast.error(getErrorMessage(e, 'Live mode poll failed'));
				liveErrorShown = true;
			}
		}
	}

	async function schedulePoll(sessionId: number) {
		if (!isActiveLiveSession(sessionId)) return;
		await pollForNewLogs(sessionId);
		if (isActiveLiveSession(sessionId)) {
			liveIntervalId = setTimeout(() => {
				void schedulePoll(sessionId);
			}, 2000);
		}
	}

	function start() {
		const index = config.getIndex();
		if (isLive || !index) return;

		const sessionId = liveSessionId + 1;
		liveSessionId = sessionId;

		isLive = true;
		newLiveLogs = 0;
		liveErrorShown = false;
		lastPollKeys = new Set();

		const nowTs = Math.floor(Date.now() / 1000);
		liveStartedAt = nowTs;

		config.onStart({ startTimestamp: nowTs, endTimestamp: nowTs });

		if (isActiveLiveSession(sessionId)) {
			liveIntervalId = setTimeout(() => {
				void schedulePoll(sessionId);
			}, 2000);
		}
	}

	function cleanup() {
		stop();
	}

	return {
		get isLive() {
			return isLive;
		},
		get newLiveLogs() {
			return newLiveLogs;
		},
		start,
		stop,
		resetNewLiveLogs,
		cleanup
	};
}
