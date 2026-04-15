<script lang="ts">
	import type { AdminIndexSource } from '$lib/types';

	let { sources }: { sources: AdminIndexSource[] } = $props();
</script>

<div class="mb-3 text-xs text-base-content/50">
	{sources.length} source{sources.length === 1 ? '' : 's'} configured
</div>
<div class="flex flex-col gap-2">
	{#each sources as source (source.sourceId)}
		<div class="rounded border border-base-300 p-3" class:opacity-50={source.enabled === false}>
			<div class="mb-2 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="font-medium">{source.sourceId}</span>
					<span class="badge badge-sm">{source.sourceType}</span>
				</div>
				{#if source.enabled !== false}
					<span class="text-xs text-success">● enabled</span>
				{:else}
					<span class="text-xs text-error">● disabled</span>
				{/if}
			</div>
			<div class="grid grid-cols-3 gap-2 text-xs">
				<div>
					<div class="text-[10px] text-base-content/50 uppercase">Input Format</div>
					<div class="text-base-content/70">{source.inputFormat ?? '—'}</div>
				</div>
				<div>
					<div class="text-[10px] text-base-content/50 uppercase">Pipelines</div>
					<div class="text-base-content/70">
						{source.numPipelines ?? 0} / {source.desiredNumPipelines ?? 0} desired
					</div>
				</div>
				<div>
					<div class="text-[10px] text-base-content/50 uppercase">Max Per Indexer</div>
					<div class="text-base-content/70">
						{source.maxNumPipelinesPerIndexer ?? '—'}
					</div>
				</div>
			</div>
			{#if source.params}
				<div class="mt-2 border-t border-base-300 pt-2">
					<div class="mb-1 text-[10px] text-base-content/50 uppercase">Params</div>
					<pre
						class="overflow-x-auto rounded bg-base-200 p-2 font-['Roboto_Mono',monospace] text-[10px] text-base-content/70">{JSON.stringify(
							source.params,
							null,
							2
						)}</pre>
				</div>
			{/if}
		</div>
	{/each}
</div>
