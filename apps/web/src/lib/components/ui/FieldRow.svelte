<script lang="ts">
	import { Copy, Minus, Plus } from 'lucide-svelte';
	import type { FieldRowData } from '$lib/types';

	let {
		field,
		keyClass = 'w-[min(38%,14rem)]',
		onFilterFor,
		onFilterOut,
		onCopy
	}: {
		field: FieldRowData;
		keyClass?: string;
		onFilterFor?: (field: FieldRowData) => void;
		onFilterOut?: (field: FieldRowData) => void;
		onCopy?: (field: FieldRowData) => void;
	} = $props();

	const hasActions = $derived(Boolean(onFilterFor || onFilterOut || onCopy));
</script>

<tr class="group border-line border-b align-top last:border-b-0">
	<td
		class={[
			'border-line text-base-content/70 truncate border-r px-3 py-1.5 font-mono text-xs',
			keyClass
		]}
		title={field.name}
	>
		{field.displayName}
	</td>
	<td
		class={[
			'text-base-content relative px-3 py-1.5 font-mono text-xs',
			hasActions && !field.isEmpty && 'pr-20'
		]}
	>
		{#if field.isEmpty}
			<span class="text-base-content/30">—</span>
		{:else}
			<span class="break-words whitespace-pre-wrap">{field.value}</span>
			{#if hasActions}
				<span
					class="join pointer-events-none absolute top-0.5 right-2 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
				>
					{#if onFilterFor}
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
					{/if}
					{#if onFilterOut}
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
					{/if}
					{#if onCopy}
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
					{/if}
				</span>
			{/if}
		{/if}
	</td>
</tr>
