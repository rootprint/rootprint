<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import DrawerFieldRow from '../DrawerFieldRow.svelte';
	import { levelColor } from '$lib/constants/level-colors';
	import { groupHitFields } from '$lib/utils/hit-fields';
	import { formatLogRowTimestamp } from '$lib/utils/time';
	import type { ContextEntry, FieldConfig, TimezoneMode } from '$lib/types';

	let {
		entry,
		fieldConfig,
		timezoneMode,
		isAnchor,
		expanded,
		onToggle
	}: {
		entry: ContextEntry;
		fieldConfig: FieldConfig;
		timezoneMode: TimezoneMode;
		isAnchor: boolean;
		expanded: boolean;
		onToggle: () => void;
	} = $props();

	const levelHex = $derived(levelColor(entry.level));
	const allFields = $derived.by(() => {
		if (!expanded) return null;
		return groupHitFields(entry.raw, fieldConfig).groups.flatMap((g) => g.fields);
	});
</script>

<button
	type="button"
	class={[
		'hover:bg-base-200/60 flex w-full cursor-pointer items-center gap-3 border-l-4 px-3 py-1.5 text-left font-mono text-xs transition-colors',
		!expanded && 'border-base-content/5 border-b'
	]}
	aria-expanded={expanded}
	data-anchor={isAnchor ? 'true' : null}
	style="border-left-color: {levelHex}{isAnchor ? `; background-color: ${levelHex}1a` : ''};"
	onclick={onToggle}
>
	{#if expanded}
		<ChevronDown class="text-base-content/50 h-3 w-3 shrink-0" />
	{:else}
		<ChevronRight class="text-base-content/50 h-3 w-3 shrink-0" />
	{/if}
	<span class="text-base-content/60 shrink-0 whitespace-nowrap">
		{formatLogRowTimestamp(entry.timestamp, timezoneMode)}
	</span>
	<span class="min-w-0 flex-1 truncate">{entry.message}</span>
</button>

{#if expanded && allFields}
	<div
		class="border-base-content/5 bg-base-200/30 border-b border-l-4 px-3 py-2"
		style="border-left-color: {levelHex};"
	>
		{#if allFields.length === 0}
			<p class="text-base-content/40 text-xs italic">No fields</p>
		{:else}
			<table class="w-full table-fixed border-collapse">
				<tbody>
					{#each allFields as field (field.name)}
						<DrawerFieldRow {field} />
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
{/if}
