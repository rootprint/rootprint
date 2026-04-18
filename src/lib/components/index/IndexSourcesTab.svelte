<script lang="ts">
	import { Search } from 'lucide-svelte';

	import type { QuickwitSource } from '$lib/types';

	let { sources }: { sources: QuickwitSource[] } = $props();

	let enabledOverrides = $state<Record<string, boolean>>({});
	let filter = $state('');

	function isEnabled(source: QuickwitSource): boolean {
		if (source.sourceId in enabledOverrides) return enabledOverrides[source.sourceId];
		return source.enabled;
	}

	const filtered = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		if (!q) return sources;
		return sources.filter((s) => s.sourceId.toLowerCase().includes(q));
	});

	const countLabel = $derived.by(() => {
		if (filter.trim().length > 0) {
			return `${filtered.length} of ${sources.length}`;
		}
		return `${sources.length} source${sources.length === 1 ? '' : 's'}`;
	});

	function toggle(sourceId: string, value: boolean) {
		enabledOverrides[sourceId] = value;
	}
</script>

<section>
	<p class="mb-3 text-sm text-base-content/60">Data sources ingesting into this index</p>

	<div class="mb-3 flex flex-wrap items-center gap-3">
		<label class="input-bordered input input-sm flex flex-1 items-center gap-2">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				class="grow"
				placeholder="Search sources…"
				aria-label="Search sources"
				bind:value={filter}
			/>
		</label>

		<span class="text-sm text-base-content/60">{countLabel}</span>
	</div>

	<div class="divide-y divide-base-300 rounded-box border border-base-300">
		{#each filtered as source (source.sourceId)}
			{@const enabled = isEnabled(source)}
			<div
				class="flex min-h-14 items-center gap-3 px-4 py-3 first:rounded-t-box last:rounded-b-box hover:bg-base-200/40"
				class:opacity-60={!enabled}
			>
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm font-semibold">{source.sourceId}</div>
					<div class="mt-0.5">
						<span class="badge badge-sm">{source.sourceType}</span>
					</div>
				</div>

				<div class="flex shrink-0 items-center gap-3 text-xs text-base-content/60">
					<span>{source.inputFormat ?? '—'}</span>
					<span>{source.numPipelines ?? 0} pipelines</span>
				</div>

				<input
					type="checkbox"
					class="toggle shrink-0 toggle-sm toggle-success"
					aria-label="Enable source {source.sourceId}"
					checked={enabled}
					onchange={(e) => toggle(source.sourceId, e.currentTarget.checked)}
				/>
			</div>
		{:else}
			<div class="py-10 text-center text-sm text-base-content/60">
				{#if filter.trim() !== ''}
					No sources match your search.
				{:else}
					No sources configured.
				{/if}
			</div>
		{/each}
	</div>
</section>
