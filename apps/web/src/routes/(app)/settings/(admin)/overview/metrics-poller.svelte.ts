import { getAdminMetrics, type AdminMetrics } from '$lib/api/admin';

const POLL_INTERVAL_MS = 5000;
const MAX_FAILURES = 3;

/**
 * Polls admin metrics on an interval, tracking consecutive failures and staleness.
 * Pauses while the tab is hidden. Call `start()` from onMount and `stop()` from onDestroy.
 */
export class MetricsPoller {
	metrics = $state<AdminMetrics | null>(null);
	failures = $state(0);
	lastMetricsAt = $state<number | null>(null);
	now = $state(Date.now());

	#timer: ReturnType<typeof setTimeout> | null = null;
	#stopped = true;
	#pollSeq = 0;

	/** Seconds since the last successful poll; `null` before the first. */
	get staleSeconds(): number | null {
		if (this.lastMetricsAt === null) return null;
		return Math.max(0, Math.floor((this.now - this.lastMetricsAt) / 1000));
	}

	get unavailable(): boolean {
		return this.failures >= MAX_FAILURES;
	}

	get stale(): boolean {
		return this.staleSeconds !== null && this.staleSeconds > POLL_INTERVAL_MS / 1000 + 2;
	}

	get liveSummary() {
		const m = this.metrics;
		if (!m) return null;
		return {
			cpuBusyRatio: m.saturation.cpuBusyRatio,
			memoryRssBytes: m.resources.memoryRssBytes,
			fdsOpen: m.resources.fdsOpen,
			fdsMax: m.resources.fdsMax,
			walDiskBytes: m.resources.walDiskBytes
		};
	}

	async poll(): Promise<void> {
		const seq = ++this.#pollSeq;
		try {
			const metrics = await getAdminMetrics();
			if (seq !== this.#pollSeq) return;
			this.metrics = metrics;
			this.lastMetricsAt = Date.now();
			this.failures = 0;
		} catch {
			if (seq !== this.#pollSeq) return;
			this.failures += 1;
		}
	}

	start(): void {
		this.#stopped = false;
		void this.poll();
		this.#schedule();
		document.addEventListener('visibilitychange', this.#onVisibility);
	}

	stop(): void {
		this.#stopped = true;
		this.#pollSeq++;
		this.#stopTimer();
		document.removeEventListener('visibilitychange', this.#onVisibility);
	}

	#schedule(): void {
		if (this.#stopped) return;
		this.#stopTimer();
		this.#timer = setTimeout(async () => {
			await this.poll();
			if (this.#stopped) return;
			this.now = Date.now();
			this.#schedule();
		}, POLL_INTERVAL_MS);
	}

	#stopTimer(): void {
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
	}

	#onVisibility = (): void => {
		if (document.visibilityState === 'hidden') {
			this.#stopTimer();
		} else {
			void this.poll();
			this.#schedule();
		}
	};
}
