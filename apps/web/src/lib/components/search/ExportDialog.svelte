<script lang="ts">
	import { untrack } from 'svelte';
	import { Download, Info } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { buildExportUrl, preflightExport } from '$lib/api/exports';
	import { isAbortError } from '$lib/api/errors';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { EXPORT_MAX_ROWS } from 'api/constants';
	import type { ExportFormat } from 'api/types';

	type Props = {
		indexId: string | null;
		composedQuery: string;
		startTs: number | undefined;
		endTs: number | undefined;
		numHits: number;
		open?: boolean;
	};

	let {
		indexId,
		composedQuery,
		startTs,
		endTs,
		numHits,
		open = $bindable(false)
	}: Props = $props();

	type DialogState = 'idle' | 'preflighting' | 'error';

	let format = $state<ExportFormat>('json');
	let dialogState = $state<DialogState>('idle');
	let formError = $state<string | null>(null);
	let preflightTotal = $state<number | null>(null);
	let preflightCapped = $state(false);
	let preflightController: AbortController | null = null;

	// Live props are snapshotted on open so a re-search while the dialog is
	// visible can't desync the displayed count/window from what gets exported.
	let lockedIndexId = $state<string | null>(null);
	let lockedQuery = $state('*');
	let lockedStartTs = $state<number | undefined>(undefined);
	let lockedEndTs = $state<number | undefined>(undefined);
	let lockedNumHits = $state(0);

	const FORMATS: { value: ExportFormat; label: string }[] = [
		{ value: 'json', label: 'JSON' },
		{ value: 'csv', label: 'CSV' },
		{ value: 'text', label: 'Text' }
	];

	$effect(() => {
		if (open) {
			untrack(() => {
				lockedIndexId = indexId;
				lockedQuery = composedQuery;
				lockedStartTs = startTs;
				lockedEndTs = endTs;
				lockedNumHits = numHits;
			});
			dialogState = 'idle';
			formError = null;
			preflightTotal = null;
			preflightCapped = false;
		} else {
			preflightController?.abort();
			preflightController = null;
		}
	});

	const canExport = $derived(
		lockedIndexId !== null &&
			lockedStartTs !== undefined &&
			lockedEndTs !== undefined &&
			lockedNumHits > 0 &&
			dialogState !== 'preflighting'
	);

	const previewTotal = $derived(preflightTotal ?? Math.min(lockedNumHits, EXPORT_MAX_ROWS));
	const previewCapped = $derived(preflightCapped || lockedNumHits > EXPORT_MAX_ROWS);

	function exportLabel(f: ExportFormat): string {
		const upper = f === 'json' ? 'JSON' : f === 'csv' ? 'CSV' : 'Text';
		return `Export ${previewTotal.toLocaleString()} logs as ${upper}`;
	}

	async function startExport() {
		if (
			!canExport ||
			lockedIndexId === null ||
			lockedStartTs === undefined ||
			lockedEndTs === undefined
		)
			return;

		const exportInput = {
			indexId: lockedIndexId,
			query: lockedQuery,
			startTs: lockedStartTs,
			endTs: lockedEndTs,
			format
		};

		preflightController?.abort();
		preflightController = new AbortController();
		dialogState = 'preflighting';
		formError = null;

		try {
			const result = await preflightExport(exportInput, preflightController.signal);

			if (result.total === 0) {
				dialogState = 'error';
				formError = 'No logs match in this time range.';
				return;
			}

			preflightTotal = result.total;
			preflightCapped = result.capped;

			const url = buildExportUrl(exportInput);
			const a = document.createElement('a');
			a.href = url;
			a.download = '';
			document.body.appendChild(a);
			a.click();
			a.remove();

			toast.success('Export started — check your downloads');
			open = false;
		} catch (e) {
			if (isAbortError(e)) return;
			dialogState = 'error';
			formError = e instanceof Error ? e.message : 'Export failed';
		}
	}
</script>

<Modal bind:open title="Export Logs">
	<div class="flex flex-col gap-3">
		<div>
			<div class="text-base-content/50 mb-1 text-xs font-semibold tracking-wider uppercase">
				Format
			</div>
			<div class="join w-full">
				{#each FORMATS as opt (opt.value)}
					<button
						type="button"
						class="btn btn-ghost join-item btn-xs flex-1 {format === opt.value ? 'btn-active' : ''}"
						onclick={() => (format = opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<p class="text-base-content/70 text-sm">
			{lockedNumHits.toLocaleString()} logs match your search
		</p>

		{#if previewCapped}
			<div
				class="border-warning/60 bg-base-200/60 text-base-content/80 flex items-center gap-2 rounded-r border-l-2 px-3 py-2 text-xs"
			>
				<Info class="text-warning h-3.5 w-3.5 shrink-0" />
				Only the first {EXPORT_MAX_ROWS.toLocaleString()} logs will be exported
			</div>
		{/if}

		{#if dialogState === 'error'}
			<div role="alert" class="alert alert-error py-2 text-xs">{formError}</div>
		{/if}

		<button
			type="button"
			class="btn btn-primary btn-sm w-full"
			disabled={!canExport}
			onclick={startExport}
		>
			{#if dialogState === 'preflighting'}
				<span class="loading loading-spinner loading-xs"></span>
				Preparing…
			{:else}
				<Download class="h-3.5 w-3.5" />
				{exportLabel(format)}
			{/if}
		</button>
	</div>
</Modal>
