<script lang="ts">
	import IndexConfigTab from '$lib/components/index/IndexConfigTab.svelte';
	import IndexDetailsTab from '$lib/components/index/IndexDetailsTab.svelte';
	import IndexFieldsTab from '$lib/components/index/IndexFieldsTab.svelte';
	import IndexSourcesTab from '$lib/components/index/IndexSourcesTab.svelte';

	let { data } = $props();
	let fieldFilter = $state('');

	const title = $derived(data.detail.displayName ?? data.detail.indexId);
	const filteredFields = $derived.by(() => {
		const query = fieldFilter.trim().toLowerCase();

		if (!query) return data.detail.fields;

		return data.detail.fields.filter((field) => field.name.toLowerCase().includes(query));
	});
</script>

<div class="flex flex-col gap-6">
	<div>
		<a href="/administration/indexes" class="link text-sm text-base-content/60 link-hover">
			Back to indexes
		</a>
		<h3 class="mt-2 text-xl font-semibold">{title}</h3>
		{#if data.detail.displayName}
			<p class="text-sm text-base-content/60">{data.detail.indexId}</p>
		{/if}
	</div>

	<section>
		<h2 class="mb-3 text-xl font-semibold">Details</h2>
		<IndexDetailsTab detail={data.detail} />
	</section>

	<section>
		<div class="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div>
				<h2 class="text-xl font-semibold">Fields</h2>
				<p class="text-xs text-base-content/50">
					{filteredFields.length} field{filteredFields.length === 1 ? '' : 's'}
				</p>
			</div>
			<input
				class="input-bordered input input-sm w-full md:max-w-xs"
				placeholder="Filter fields..."
				bind:value={fieldFilter}
			/>
		</div>
		<div class="overflow-x-auto rounded-box border border-base-300">
			<IndexFieldsTab fields={filteredFields} />
		</div>
	</section>

	<section>
		<div class="mb-3">
			<h2 class="text-xl font-semibold">Sources</h2>
			<p class="text-xs text-base-content/50">Quickwit source configuration for this index</p>
		</div>
		<IndexSourcesTab sources={data.detail.sources} />
	</section>

	<section>
		<IndexConfigTab detail={data.detail} />
	</section>
</div>
