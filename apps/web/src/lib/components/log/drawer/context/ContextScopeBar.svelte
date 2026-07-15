<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import { page } from '$app/state';

	let {
		selected,
		fieldTabs,
		indexId,
		disabled = false,
		onChange,
		onOpenAsSearch
	}: {
		selected: string[];
		fieldTabs: { field: string; disabled: boolean }[];
		indexId: string;
		disabled?: boolean;
		onChange: (fields: string[]) => void;
		onOpenAsSearch: () => void;
	} = $props();

	const isAdmin = $derived(
		(page.data.session?.user as { role?: string } | undefined)?.role === 'admin'
	);

	function toggle(field: string): void {
		onChange(selected.includes(field) ? selected.filter((f) => f !== field) : [...selected, field]);
	}
</script>

<div class="border-line bg-base-100 flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
	<div class="join">
		<button
			type="button"
			class="btn btn-xs join-item {selected.length === 0 ? 'btn-active' : ''}"
			title="Show all surrounding logs, no field filter"
			{disabled}
			onclick={() => onChange([])}
		>
			All
		</button>
		{#each fieldTabs as tab (tab.field)}
			<button
				type="button"
				class="btn btn-xs join-item max-w-[12rem] {selected.includes(tab.field)
					? 'btn-active'
					: ''}"
				disabled={disabled || tab.disabled}
				title={tab.disabled
					? 'This log has no value for this field'
					: `Toggle filtering by this log's ${tab.field}`}
				onclick={() => toggle(tab.field)}
			>
				<span class="truncate font-mono">{tab.field}</span>
			</button>
		{/each}
	</div>

	<div class="ml-auto flex items-center gap-1.5">
		{#if isAdmin}
			<a href="/settings/indexes/{indexId}" class="btn btn-xs btn-outline">Configure</a>
		{/if}
		<button
			type="button"
			class="btn btn-xs btn-ghost"
			title="Open these filters and the surrounding time window in the main search"
			{disabled}
			onclick={onOpenAsSearch}
		>
			<ExternalLink class="h-3 w-3" />
			Open as full search
		</button>
	</div>
</div>
