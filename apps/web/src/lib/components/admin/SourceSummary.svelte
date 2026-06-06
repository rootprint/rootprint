<script lang="ts">
	import type { SourceDetail } from 'api/types';
	import { isManagedSource } from './source-form';

	let { source }: { source: SourceDetail } = $props();

	const managed = $derived(isManagedSource(source));

	// ingest-api never supports VRL; for other read-only types show the script if
	// one happens to be configured.
	const showVrl = $derived(source.sourceType !== 'ingest-api' && Boolean(source.vrlScript));

	type Row = { label: string; value: string };
	const rows = $derived.by(() => {
		const out: Row[] = [{ label: 'Source type', value: source.sourceType }];
		if (source.streamName) out.push({ label: 'Stream name', value: source.streamName });
		if (source.region) out.push({ label: 'Region', value: source.region });
		if (source.endpoint) out.push({ label: 'Endpoint', value: source.endpoint });
		if (source.queueUrl) out.push({ label: 'SQS queue URL', value: source.queueUrl });
		if (source.messageType) out.push({ label: 'Message type', value: source.messageType });
		if (source.inputFormat) out.push({ label: 'Input format', value: source.inputFormat });
		if (source.numPipelines != null)
			out.push({ label: 'Number of pipelines', value: String(source.numPipelines) });
		return out;
	});
</script>

<div class="border-line rounded-box bg-base-100 divide-line flex flex-col divide-y border">
	<div class="px-4 py-3">
		<p class="text-base-content/60 text-xs">
			{#if managed}
				This is a built-in source managed by Quickwit. It can be viewed but not edited, disabled, or
				deleted here.
			{:else}
				This {source.sourceType} source isn't editable in Rootprint. It can be viewed here.
			{/if}
		</p>
	</div>

	{#each rows as row (row.label)}
		<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
			<div class="text-sm">{row.label}</div>
			<div class="text-sm break-all">{row.value}</div>
		</div>
	{/each}

	{#if showVrl}
		<div class="flex flex-col gap-3 px-4 py-4">
			<div>
				<div class="text-sm">VRL script</div>
				<div class="text-base-content/60 mt-0.5 text-xs">Transform applied before indexing.</div>
			</div>
			<pre
				class="bg-base-200 rounded-box overflow-x-auto p-3 font-mono text-xs whitespace-pre-wrap">{source.vrlScript ??
					''}</pre>
		</div>
	{/if}
</div>
