<script lang="ts">
	import { Copy, Minus, Plus } from 'lucide-svelte';
	import type { DrawerField } from '$lib/utils/hit-fields';

	let {
		field,
		onFilterFor,
		onFilterOut,
		onCopy
	}: {
		field: DrawerField;
		onFilterFor?: (field: DrawerField) => void;
		onFilterOut?: (field: DrawerField) => void;
		onCopy?: (field: DrawerField) => void;
	} = $props();

	const hasActions = $derived(Boolean(onFilterFor || onFilterOut || onCopy));
</script>

<tr class="group border-line border-b align-top">
	<td
		class="border-line text-base-content/70 w-56 max-w-[14rem] truncate border-r px-3 py-1.5 font-mono text-xs"
		title={field.name}
	>
		{field.displayName}
	</td>
	<td class="text-base-content relative px-3 py-1.5 font-mono text-xs">
		{#if field.isEmpty}
			<span class="text-base-content/30">—</span>
		{:else}
			<span class="break-words whitespace-pre-wrap">{field.value}</span>
			{#if hasActions}
				<span
					class="join absolute top-0.5 right-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
				>
					<button
						type="button"
						class="btn btn-xs btn-square join-item"
						aria-label="Filter for value"
						title="Filter for value"
						onclick={(e) => {
							onFilterFor?.(field);
							e.currentTarget.blur();
						}}
					>
						<Plus class="h-3 w-3" />
					</button>
					<button
						type="button"
						class="btn btn-xs btn-square join-item"
						aria-label="Filter out value"
						title="Filter out value"
						onclick={(e) => {
							onFilterOut?.(field);
							e.currentTarget.blur();
						}}
					>
						<Minus class="h-3 w-3" />
					</button>
					<button
						type="button"
						class="btn btn-xs btn-square join-item"
						aria-label="Copy value"
						title="Copy value"
						onclick={(e) => {
							onCopy?.(field);
							e.currentTarget.blur();
						}}
					>
						<Copy class="h-3 w-3" />
					</button>
				</span>
			{/if}
		{/if}
	</td>
</tr>
