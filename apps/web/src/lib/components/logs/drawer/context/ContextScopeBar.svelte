<script lang="ts">
	import { Check, ExternalLink, Settings2 } from 'lucide-svelte';
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

	const isAdmin = $derived(page.data.session?.user?.role === 'admin');

	function toggle(field: string): void {
		onChange(selected.includes(field) ? selected.filter((f) => f !== field) : [...selected, field]);
	}

	const chipBase =
		'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-60';
	const chipSelected = 'bg-primary border-primary text-primary-content';
	const chipIdle =
		'border-base-content/15 text-muted hover:border-base-content/40 hover:text-base-content';
	const chipNoValue = 'border-base-content/15 text-subtle cursor-not-allowed border-dashed';
</script>

<div class="border-line bg-base-100 flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
	<span class="text-muted shrink-0 text-xs">Scope</span>

	<button
		type="button"
		class={[chipBase, selected.length === 0 ? chipSelected : chipIdle]}
		title="Show all surrounding logs, no field filter"
		{disabled}
		onclick={() => onChange([])}
	>
		{#if selected.length === 0}
			<Check class="size-3 shrink-0" aria-hidden="true" />
		{/if}
		All
	</button>

	{#each fieldTabs as tab (tab.field)}
		{@const isSelected = selected.includes(tab.field)}
		<button
			type="button"
			class={[
				chipBase,
				'max-w-[12rem]',
				tab.disabled ? chipNoValue : isSelected ? chipSelected : chipIdle
			]}
			disabled={disabled || tab.disabled}
			title={tab.disabled
				? 'This log has no value for this field'
				: `Toggle filtering by this log's ${tab.field}`}
			onclick={() => toggle(tab.field)}
		>
			{#if isSelected}
				<Check class="size-3 shrink-0" aria-hidden="true" />
			{/if}
			<span class="truncate font-mono">{tab.field}</span>
		</button>
	{/each}

	<div class="ml-auto flex items-center gap-1">
		{#if isAdmin}
			<a
				href="/settings/indexes/{indexId}"
				class="btn btn-ghost btn-xs btn-square"
				title="Configure context fields"
				aria-label="Configure context fields"
			>
				<Settings2 class="size-3" aria-hidden="true" />
			</a>
		{/if}
		<button
			type="button"
			class="btn btn-ghost btn-xs btn-square"
			title="Open as full search"
			aria-label="Open as full search"
			{disabled}
			onclick={onOpenAsSearch}
		>
			<ExternalLink class="size-3" aria-hidden="true" />
		</button>
	</div>
</div>
