<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import DrawerFieldRow from './DrawerFieldRow.svelte';
	import type { DrawerField, FieldGroup, FieldGroupId } from '$lib/utils/hit-fields';
	import { groupHitFields } from '$lib/utils/hit-fields';
	import { copyWithToast } from '$lib/utils/clipboard';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';
	import type { LogHit } from '$lib/types';
	import type { SearchStore } from '$lib/stores/search.svelte';

	let {
		hit,
		searchTerm,
		store
	}: {
		hit: LogHit;
		searchTerm: string;
		store: SearchStore;
	} = $props();

	let showEmpty = $state(false);
	let collapsed = $state<Partial<Record<FieldGroupId, boolean>>>({});
	let previousHitKey: LogHit['key'] | null = null;

	$effect(() => {
		if (hit.key === previousHitKey) return;
		previousHitKey = hit.key;
		collapsed = {};
	});

	const grouped = $derived.by(() => {
		const cfg = store.fieldConfig;
		if (!cfg) return { message: '', messageLabel: '', groups: [] as FieldGroup[] };
		return groupHitFields(hit.raw, cfg);
	});

	const visibleGroups = $derived.by(() => {
		const result: FieldGroup[] = [];
		for (const group of grouped.groups) {
			const filtered = showEmpty ? group.fields : group.fields.filter((f) => !f.isEmpty);
			if (filtered.length === 0) continue;
			result.push({ ...group, fields: filtered });
		}
		return result;
	});

	const totalRows = $derived(visibleGroups.reduce((sum, g) => sum + g.fields.length, 0));

	function toggle(id: FieldGroupId) {
		collapsed = { ...collapsed, [id]: !collapsed[id] };
	}

	function applyFilter(field: DrawerField, negate: boolean) {
		store.addFilter(field.name, field.value, negate);
	}

	function copyValue(field: DrawerField) {
		void copyWithToast(field.value, 'Value copied');
	}
</script>

<OverlayScrollbarsComponent options={OS_SCROLLBAR_OPTIONS} defer class="h-full">
	<div class="border-line border-b p-3">
		<p class="eyebrow mb-1.5">{grouped.messageLabel}</p>
		<div
			class="border-line rounded-md border p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
		>
			{#if grouped.message === ''}
				<span class="text-base-content/40">(no message)</span>
			{:else}
				{grouped.message}
			{/if}
		</div>
	</div>

	<div class="border-line flex items-center justify-between border-b px-3 py-2">
		<label class="text-base-content/70 flex cursor-pointer items-center gap-2 text-xs">
			<input type="checkbox" class="checkbox checkbox-xs" bind:checked={showEmpty} />
			Show empty values
		</label>
		<span class="text-base-content/40 text-[10px]">{totalRows} fields</span>
	</div>

	{#if visibleGroups.length === 0}
		<p class="text-base-content/40 p-6 text-center text-xs">No fields to display</p>
	{:else}
		<div class="flex flex-col gap-3 p-3">
			{#each visibleGroups as group (group.id)}
				{@const isCollapsed = !!collapsed[group.id]}
				<section>
					{#if group.label !== null}
						<button
							type="button"
							class="focus-visible:outline-base-content/40 mb-1.5 flex items-center gap-2 rounded-sm text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
							aria-expanded={!isCollapsed}
							aria-controls={`drawer-group-${group.id}`}
							onclick={() => toggle(group.id)}
						>
							<span class="inline-flex transition-transform" class:-rotate-90={isCollapsed}>
								<ChevronDown class="text-base-content/50 h-3 w-3" />
							</span>
							<p class="eyebrow">{group.label}</p>
							<span class="bg-primary text-primary-content rounded-sm px-1.5 py-0.5 text-[10px]"
								>{group.fields.length}</span
							>
						</button>
					{/if}

					{#if !isCollapsed}
						<div
							id={`drawer-group-${group.id}`}
							class="border-line overflow-hidden rounded-md border"
						>
							<table class="w-full table-fixed border-collapse">
								<tbody>
									{#each group.fields as field (field.name)}
										<DrawerFieldRow
											{field}
											{searchTerm}
											onFilterFor={(f) => applyFilter(f, false)}
											onFilterOut={(f) => applyFilter(f, true)}
											onCopy={copyValue}
										/>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</OverlayScrollbarsComponent>
