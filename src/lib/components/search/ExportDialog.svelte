<script lang="ts">
	import { Download, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { EXPORT_MAX_LOGS } from '$lib/constants/ingest';
	import type { ExportFormat } from '$lib/types';

	let {
		numHits,
		query,
		startTimestamp,
		endTimestamp,
		indexId
	}: {
		numHits: number;
		query: string;
		startTimestamp: number | undefined;
		endTimestamp: number | undefined;
		indexId: string | null;
	} = $props();

	type DialogState = 'form' | 'progress' | 'error';

	let open = $state(false);
	let format = $state<ExportFormat>('ndjson');
	let dialogState = $state<DialogState>('form');
	let fetched = $state(0);
	let total = $state(0);
	let progressStatus = $state<string>('');
	let errorMessage = $state('');
	let eventSource: EventSource | null = null;

	const effectiveTotal = $derived(Math.min(numHits, EXPORT_MAX_LOGS));

	const FORMATS: { value: ExportFormat; label: string }[] = [
		{ value: 'ndjson', label: 'NDJSON' },
		{ value: 'csv', label: 'CSV' },
		{ value: 'text', label: 'Text' }
	];

	function reset() {
		dialogState = 'form';
		fetched = 0;
		total = 0;
		progressStatus = '';
		errorMessage = '';
		closeEventSource();
	}

	function openDialog() {
		reset();
		open = true;
	}

	function closeDialog() {
		closeEventSource();
		open = false;
	}

	function closeEventSource() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
	}

	async function startExport() {
		if (!indexId || startTimestamp === undefined || endTimestamp === undefined) return;

		dialogState = 'progress';
		progressStatus = 'Starting export...';

		try {
			const res = await fetch('/api/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					indexId,
					query,
					startTimestamp,
					endTimestamp,
					format
				})
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({ message: 'Export request failed' }));
				throw new Error(data.message || `HTTP ${res.status}`);
			}

			const { exportId } = await res.json();
			listenForProgress(exportId);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Export failed';
			dialogState = 'error';
		}
	}

	function listenForProgress(exportId: string) {
		eventSource = new EventSource(`/api/export/${exportId}/progress`);

		eventSource.onmessage = (event) => {
			let data: { status: string; fetched?: number; total?: number; message?: string };
			try {
				data = JSON.parse(event.data);
			} catch {
				return;
			}

			switch (data.status) {
				case 'fetching':
					fetched = data.fetched ?? 0;
					total = data.total ?? 0;
					progressStatus = `Fetching ${fetched.toLocaleString()} / ${total.toLocaleString()} logs...`;
					break;
				case 'compressing':
					progressStatus = 'Compressing...';
					break;
				case 'complete':
					closeEventSource();
					triggerDownload(exportId);
					break;
				case 'error':
					closeEventSource();
					errorMessage = data.message || 'Export failed';
					dialogState = 'error';
					break;
			}
		};

		eventSource.onerror = () => {
			closeEventSource();
			errorMessage = 'Lost connection to export server';
			dialogState = 'error';
		};
	}

	function triggerDownload(exportId: string) {
		const a = document.createElement('a');
		a.href = `/api/export/${exportId}/download`;
		a.download = '';
		a.click();
		toast.success('Export download started');
		closeDialog();
	}

	const progressPercent = $derived(total > 0 ? Math.round((fetched / total) * 100) : 0);
</script>

<button class="btn btn-sm" disabled={numHits === 0} onclick={openDialog}>
	<Download size={14} />
	Export
</button>

{#if open}
	<dialog class="modal-open modal">
		<div class="modal-box w-80">
			<button class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm" onclick={closeDialog}>
				<X size={16} />
			</button>

			<h3 class="mb-4 text-lg font-bold">Export Logs</h3>

			{#if dialogState === 'form'}
				<div class="mb-3">
					<div class="mb-1 text-xs font-semibold tracking-wider text-base-content/50 uppercase">
						Format
					</div>
					<div class="join w-full">
						{#each FORMATS as { value, label } (value)}
							<button
								class="btn join-item flex-1 btn-xs {format === value ? 'btn-accent' : ''}"
								onclick={() => (format = value)}
							>
								{label}
							</button>
						{/each}
					</div>
				</div>

				<p class="mb-2 text-sm text-base-content/70">
					{numHits.toLocaleString()} logs match your search
				</p>

				{#if numHits > EXPORT_MAX_LOGS}
					<div class="mb-3 alert py-2 text-xs alert-warning">
						Only the first {EXPORT_MAX_LOGS.toLocaleString()} logs will be exported
					</div>
				{/if}

				<button
					class="btn w-full btn-sm btn-accent"
					disabled={!indexId || startTimestamp === undefined || endTimestamp === undefined}
					onclick={startExport}
				>
					<Download size={14} />
					Export {effectiveTotal.toLocaleString()} logs
				</button>
			{:else if dialogState === 'progress'}
				<div class="space-y-3">
					<p class="text-sm">{progressStatus}</p>
					{#if progressStatus.includes('Compressing')}
						<progress class="progress w-full progress-accent"></progress>
					{:else}
						<progress class="progress w-full progress-accent" value={progressPercent} max="100"
						></progress>
					{/if}
					<p class="text-right text-xs text-base-content/50">{progressPercent}%</p>
				</div>
			{:else if dialogState === 'error'}
				<div class="space-y-3">
					<div class="alert py-2 text-xs alert-error">{errorMessage}</div>
					<div class="flex gap-2">
						<button class="btn flex-1 btn-sm" onclick={closeDialog}>Cancel</button>
						<button class="btn flex-1 btn-sm btn-accent" onclick={startExport}>Retry</button>
					</div>
				</div>
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={closeDialog}>close</button>
		</form>
	</dialog>
{/if}
