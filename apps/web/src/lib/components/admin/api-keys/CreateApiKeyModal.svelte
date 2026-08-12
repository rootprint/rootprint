<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { createApiKey, type ApiKeyView } from '$lib/api/api-keys';
	import Field from '$lib/components/ui/Field.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import OneTimeKeyReveal from '$lib/components/ui/OneTimeKeyReveal.svelte';
	import SelectField from '$lib/components/ui/SelectField.svelte';
	import { createApiKeySchema } from 'api/schemas';
	import type { IndexSummary } from 'api/types';

	let {
		open = $bindable(false),
		indexes,
		defaultIndexId,
		traceIndexId,
		invalidateKey,
		revealOnCreate = true,
		onCreated
	}: {
		open?: boolean;
		indexes: IndexSummary[];
		/** Preselected index; ignored when not present in `indexes`. */
		defaultIndexId?: string;
		/** Null when the span store does not exist in Quickwit. */
		traceIndexId: string | null;
		invalidateKey?: string;
		revealOnCreate?: boolean;
		onCreated?: (summary: ApiKeyView, secret: string) => void;
	} = $props();

	function initialIndexId() {
		if (defaultIndexId !== undefined && indexes.some((i) => i.indexId === defaultIndexId)) {
			return defaultIndexId;
		}
		return indexes.length === 1 ? indexes[0].indexId : '';
	}

	let name = $state('');
	let indexId = $state(initialIndexId());
	let revealedKey = $state('');
</script>

{#snippet keyReveal()}
	<OneTimeKeyReveal value={revealedKey} label="Ingest key" />
{/snippet}

<FormModal
	bind:open
	title="Create ingest key"
	submitLabel="Create ingest key"
	schema={createApiKeySchema}
	values={() => ({ name, indexId })}
	reveal={revealOnCreate ? keyReveal : undefined}
	onclose={() => {
		name = '';
		indexId = initialIndexId();
		revealedKey = '';
	}}
	submit={async (input) => {
		const result = await createApiKey(input);
		revealedKey = result.token;
		// awaited so onCreated observers see the refreshed list — the send-telemetry wizard
		// derives its index from it; caught so a failed refresh cannot strand the one-time token
		if (invalidateKey) await invalidate(invalidateKey).catch(() => {});
		onCreated?.(result.summary, result.token);
	}}
>
	{#snippet fields(errors)}
		<Field
			label="Name"
			placeholder="production-shipper"
			autocomplete="off"
			bind:value={name}
			error={errors.name}
			required
		/>

		<SelectField
			label="Index"
			bind:value={indexId}
			options={indexes.map((i) => ({ value: i.indexId, label: i.indexId }))}
			placeholder="Select an index…"
			error={errors.indexId}
		/>

		{#if traceIndexId}
			<p class="text-base-content/60 text-xs">
				Spans from this key go to <span class="font-mono">{traceIndexId}</span>.
			</p>
		{:else}
			<p class="text-warning text-xs">
				No span store exists in Quickwit yet, so spans sent with this key have nowhere to land.
			</p>
		{/if}
	{/snippet}
</FormModal>
