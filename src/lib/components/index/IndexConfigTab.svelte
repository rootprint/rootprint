<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { saveIndexConfig } from '$lib/api/indexes.remote';
	import type { PageData } from '../../../routes/(app)/administration/$types';

	type IndexDetail = PageData['indexDetails'][number];

	let { detail }: { detail: IndexDetail } = $props();

	const configForm = $derived(saveIndexConfig.for(detail.indexId));

	$effect(() => {
		configForm.fields.set({
			indexId: detail.indexId,
			levelField: detail.levelField ?? 'level',
			messageField: detail.messageField ?? 'message',
			tracebackField: detail.tracebackField ?? ''
		});
	});
</script>

<h3 class="mb-1 text-sm font-semibold">Logwiz Configuration</h3>
<p class="mb-4 text-xs text-base-content/50">Map Quickwit fields to Logwiz display roles</p>
<form
	{...configForm.enhance(async ({ submit }) => {
		try {
			await submit();
			toast.success('Index configuration saved');
		} catch (e) {
			toast.error('Failed to save configuration');
		}
	})}
	class="flex flex-col gap-4"
>
	<input {...configForm.fields.indexId.as('hidden', detail.indexId)} />
	<div>
		<label class="mb-1 block text-xs font-medium" for="levelField">Level Field</label>
		<input
			{...configForm.fields.levelField.as('text')}
			id="levelField"
			class="input-bordered input input-sm w-full"
			placeholder="e.g. level, severity"
		/>
	</div>
	<div>
		<label class="mb-1 block text-xs font-medium" for="messageField"> Message Field </label>
		<input
			{...configForm.fields.messageField.as('text')}
			id="messageField"
			class="input-bordered input input-sm w-full"
			placeholder="e.g. message, body.message"
		/>
	</div>
	<div>
		<label class="mb-1 block text-xs font-medium" for="tracebackField"> Traceback Field </label>
		<input
			{...configForm.fields.tracebackField.as('text')}
			id="tracebackField"
			class="input-bordered input input-sm w-full"
			placeholder="e.g. message.traceback, attributes.exception.stacktrace"
		/>
		<p class="mt-1 text-[10px] text-base-content/40">
			Dot-notation path to the field containing stacktrace/traceback data
		</p>
	</div>
	<div>
		<button class="btn btn-sm btn-accent" disabled={!!configForm.pending}>
			{#if configForm.pending}
				<span class="loading loading-xs loading-spinner"></span>
				Saving...
			{:else}
				Save
			{/if}
		</button>
	</div>
</form>
