<script lang="ts">
	import { RECORD_OPTIONS, TOKENIZERS } from 'api/schemas';
	import type { DynamicMappingForm } from './index-form';

	let { dm = $bindable() }: { dm: DynamicMappingForm } = $props();
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
	<label class="flex items-center gap-1.5">
		<input type="checkbox" class="checkbox checkbox-xs" bind:checked={dm.indexed} />
		indexed
	</label>
	<label class="flex items-center gap-1.5">
		<input type="checkbox" class="checkbox checkbox-xs" bind:checked={dm.stored} />
		stored
	</label>
	<label class="flex items-center gap-1.5">
		<input type="checkbox" class="checkbox checkbox-xs" bind:checked={dm.fast} />
		fast
	</label>
	<label class="flex items-center gap-1.5">
		<input type="checkbox" class="checkbox checkbox-xs" bind:checked={dm.expandDots} />
		expand dots
	</label>
	<label class="flex items-center gap-1.5">
		tokenizer
		<select bind:value={dm.tokenizer} class="select select-xs w-36">
			{#each TOKENIZERS as tok (tok)}
				<option value={tok}>{tok}</option>
			{/each}
		</select>
	</label>
	<label class="flex items-center gap-1.5">
		record
		<select bind:value={dm.record} class="select select-xs w-28">
			{#each RECORD_OPTIONS as r (r)}
				<option value={r}>{r}</option>
			{/each}
		</select>
	</label>
</div>
