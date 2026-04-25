import {
	captureSnapshots,
	getLatestSnapshotCapturedAt
} from '$lib/server/services/index-stats.service';

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const WARMUP_MS = 5_000;

let timer: ReturnType<typeof setTimeout> | null = null;

async function tick(): Promise<void> {
	try {
		const last = getLatestSnapshotCapturedAt();
		const elapsed = last ? Date.now() - last.getTime() : Infinity;
		if (elapsed >= SNAPSHOT_INTERVAL_MS) {
			await captureSnapshots();
		}
	} catch (e) {
		console.error('snapshot tick failed', e);
	} finally {
		timer = setTimeout(tick, SNAPSHOT_INTERVAL_MS);
	}
}

export function startSnapshotJob(): void {
	if (timer) return;
	timer = setTimeout(tick, WARMUP_MS);
}

function stopSnapshotJob(): void {
	if (timer) clearTimeout(timer);
	timer = null;
}

// Attach HMR dispose to *this* module so edits to the job code invalidate
// the timer, rather than relying on hooks.server.ts being re-evaluated.
if (import.meta.hot) {
	import.meta.hot.dispose(() => stopSnapshotJob());
}
