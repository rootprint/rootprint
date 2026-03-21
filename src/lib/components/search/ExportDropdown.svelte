<script lang="ts">
	import { formatAsJson, formatAsCsv, formatAsText, downloadFile } from '$lib/utils/export';
	import { Download } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let {
		logs,
		indexId,
		timestampField,
		levelField,
		messageField
	}: {
		logs: Record<string, unknown>[];
		indexId: string | null;
		timestampField: string;
		levelField: string;
		messageField: string;
	} = $props();

	type ExportFormat = 'json' | 'csv' | 'text';

	let format = $state<ExportFormat>('json');
	let dropdownOpen = $state(false);

	function generateFilename(ext: string): string {
		const now = new Date();
		const ts = now
			.toISOString()
			.replace(/[:]/g, '-')
			.replace(/\.\d+Z$/, 'Z');
		return `logwit-${indexId}-${ts}.${ext}`;
	}

	function handleExport() {
		let content: string;
		let mimeType: string;
		let ext: string;

		switch (format) {
			case 'json':
				content = formatAsJson(logs);
				mimeType = 'application/json';
				ext = 'json';
				break;
			case 'csv':
				content = formatAsCsv(logs);
				mimeType = 'text/csv';
				ext = 'csv';
				break;
			case 'text':
				content = formatAsText(logs, timestampField, levelField, messageField);
				mimeType = 'text/plain';
				ext = 'txt';
				break;
		}

		if (!content) {
			toast.error('No logs to export');
			return;
		}

		downloadFile(content, generateFilename(ext), mimeType);
		dropdownOpen = false;
	}
</script>

{#if dropdownOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div role="none" class="fixed inset-0 z-10" onclick={() => (dropdownOpen = false)}></div>
{/if}
<div class="dropdown dropdown-end" class:dropdown-open={dropdownOpen}>
	<button
		class="btn btn-sm"
		disabled={logs.length === 0}
		onclick={() => (dropdownOpen = !dropdownOpen)}
	>
		<Download size={14} />
		Export
	</button>

	{#if dropdownOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="dropdown-content z-20 mt-1 w-64 rounded-lg border border-base-300 bg-base-100 p-3 shadow-lg"
			onkeydown={(e) => e.key === 'Escape' && (dropdownOpen = false)}
		>
			<div class="mb-2 text-xs font-semibold tracking-wider text-base-content/50 uppercase">
				Format
			</div>
			<div class="join mb-3 w-full">
				{#each [['json', 'JSON'], ['csv', 'CSV'], ['text', 'Text']] as [value, label] (value)}
					<button
						class="btn join-item flex-1 btn-xs {format === value ? 'btn-accent' : ''}"
						onclick={() => (format = value as ExportFormat)}
					>
						{label}
					</button>
				{/each}
			</div>

			<button
				class="btn w-full btn-sm btn-accent"
				disabled={logs.length === 0 || !indexId}
				onclick={handleExport}
			>
				<Download size={14} />
				Export {logs.length.toLocaleString()} logs
			</button>
		</div>
	{/if}
</div>
