<script lang="ts">
	import type { DrawerField } from '$lib/utils/hit-fields';

	let {
		field
	}: {
		field: DrawerField;
	} = $props();
</script>

<tr class="border-line border-b align-top">
	<td
		class="border-line text-base-content/70 w-56 max-w-[14rem] truncate border-r px-3 py-1.5 font-mono text-xs"
		title={field.name}
	>
		{field.displayName}
	</td>
	<td class="text-base-content px-3 py-1.5 font-mono text-xs">
		{#if field.isEmpty}
			<span class="text-base-content/30">—</span>
		{:else}
			<span class="break-words whitespace-pre-wrap">{field.value}</span>
		{/if}
	</td>
</tr>
