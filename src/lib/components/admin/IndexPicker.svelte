<script lang="ts">
	let {
		indexIds,
		selected = $bindable<string[]>([])
	}: {
		indexIds: string[];
		selected: string[];
	} = $props();

	let search = $state('');

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return indexIds;
		return indexIds.filter((id) => id.toLowerCase().includes(q));
	});

	const allFilteredSelected = $derived(
		filtered.length > 0 && filtered.every((id) => selected.includes(id))
	);

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	function toggleAllFiltered() {
		if (allFilteredSelected) {
			selected = selected.filter((id) => !filtered.includes(id));
			return;
		}
		const next = new Set(selected);
		for (const id of filtered) next.add(id);
		selected = [...next];
	}
</script>

<div class="flex flex-col rounded-box border border-base-300">
	<div class="flex items-center gap-2 border-b border-base-300 p-2">
		<input
			type="search"
			class="input-bordered input input-xs flex-1"
			placeholder="Search indexes…"
			aria-label="Search indexes"
			bind:value={search}
		/>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			disabled={filtered.length === 0}
			onclick={toggleAllFiltered}
		>
			{allFilteredSelected ? 'Deselect all' : 'Select all'}
		</button>
	</div>

	<div class="max-h-40 overflow-y-auto p-2">
		{#if filtered.length === 0}
			<p class="px-1 py-2 text-xs text-base-content/60">No indexes match.</p>
		{:else}
			{#each filtered as id (id)}
				<label class="flex cursor-pointer items-center gap-3 py-1">
					<input
						type="checkbox"
						class="checkbox checkbox-xs"
						checked={selected.includes(id)}
						onchange={() => toggle(id)}
					/>
					<span class="font-mono text-xs">{id}</span>
				</label>
			{/each}
		{/if}
	</div>

	<div class="border-t border-base-300 px-2 py-1 text-xs text-base-content/60">
		{selected.length} of {indexIds.length} selected
	</div>
</div>
