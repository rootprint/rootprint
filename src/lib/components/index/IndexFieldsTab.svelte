<script lang="ts">
	import { Search } from 'lucide-svelte';

	import type { QuickwitField } from '$lib/types';

	let { fields }: { fields: QuickwitField[] } = $props();

	let filter = $state('');

	const filtered = $derived.by(() => {
		const query = filter.trim().toLowerCase();
		if (!query) return fields;
		return fields.filter((field) => field.name.toLowerCase().includes(query));
	});

	const countLabel = $derived.by(() => {
		if (filter.trim().length > 0) {
			return `${filtered.length} of ${fields.length}`;
		}
		return `${fields.length} field${fields.length === 1 ? '' : 's'}`;
	});
</script>

<div class="flex flex-col gap-3">
	<p class="text-sm text-base-content/60">Fields defined in this index's schema.</p>

	<div class="flex flex-wrap items-center gap-3">
		<label class="input-bordered input input-sm flex flex-1 items-center gap-2">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				class="grow"
				placeholder="Search fields…"
				aria-label="Search fields"
				bind:value={filter}
			/>
		</label>

		<span class="text-sm text-base-content/60">{countLabel}</span>
	</div>

	<div class="overflow-x-auto rounded-box border border-base-300">
		<table class="table table-sm">
			<thead class="sticky top-0 bg-base-100">
				<tr>
					<th>Name</th>
					<th>Type</th>
					<th>Fast</th>
					<th>Indexed</th>
					<th>Stored</th>
					<th>Record</th>
					<th>Tokenizer</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as field (field.name)}
					<tr class="group hover:bg-base-200">
						<td>
							<div class="font-medium">{field.name}</div>
							{#if field.description}
								<div class="text-[10px] text-base-content/60">
									{field.description}
								</div>
							{/if}
						</td>
						<td>
							<span class="badge badge-sm">{field.type}</span>
						</td>
						<td>
							{#if field.fast}
								<span class="text-success">✓</span>
							{:else}
								<span class="text-base-content/50">—</span>
							{/if}
						</td>
						<td>
							{#if field.indexed}
								<span class="text-success">✓</span>
							{:else}
								<span class="text-base-content/50">—</span>
							{/if}
						</td>
						<td>
							{#if field.stored}
								<span class="text-success">✓</span>
							{:else}
								<span class="text-base-content/50">—</span>
							{/if}
						</td>
						<td class="text-base-content/60">{field.record ?? '—'}</td>
						<td class="text-base-content/60">{field.tokenizer ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
