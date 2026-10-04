<script lang="ts">
	import { Minus, Plus } from 'lucide-svelte';
	import CopyButton from './CopyButton.svelte';
	import type { FieldRowData } from '#lib/types.js';

	let {
		field,
		keyClass = 'w-[min(38%,14rem)]',
		onFilterFor,
		onFilterOut
	}: {
		field: FieldRowData;
		keyClass?: string;
		onFilterFor?: (field: FieldRowData) => void;
		onFilterOut?: (field: FieldRowData) => void;
	} = $props();
</script>

<tr class="group border-line border-b align-top last:border-b-0">
	<td
		class={['border-line text-muted truncate border-r px-3 py-1.5 font-mono text-xs', keyClass]}
		title={field.name}
	>
		{field.displayName}
	</td>
	<td
		class={['text-base-content relative px-3 py-1.5 font-mono text-xs', !field.isEmpty && 'pr-20']}
	>
		{#if field.isEmpty}
			<span class="text-subtle">—</span>
		{:else}
			<span class="break-words whitespace-pre-wrap">{field.value}</span>
			<span
				class="join pointer-events-none absolute top-0.5 right-2 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
			>
				{#if onFilterFor}
					<button
						type="button"
						class="btn btn-ghost btn-xs btn-square join-item"
						aria-label="Filter for value"
						title="Filter for value"
						onclick={(e) => {
							onFilterFor?.(field);
							e.currentTarget.blur();
						}}
					>
						<Plus class="size-3" aria-hidden="true" />
					</button>
				{/if}
				{#if onFilterOut}
					<button
						type="button"
						class="btn btn-ghost btn-xs btn-square join-item"
						aria-label="Filter out value"
						title="Filter out value"
						onclick={(e) => {
							onFilterOut?.(field);
							e.currentTarget.blur();
						}}
					>
						<Minus class="size-3" aria-hidden="true" />
					</button>
				{/if}
				<CopyButton
					text={field.value}
					class="btn btn-ghost btn-xs btn-square join-item"
					aria-label="Copy value"
					title="Copy value"
				/>
			</span>
		{/if}
	</td>
</tr>
