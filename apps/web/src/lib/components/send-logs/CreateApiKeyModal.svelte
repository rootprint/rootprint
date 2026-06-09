<script lang="ts">
	import * as v from 'valibot';
	import { invalidate } from '$app/navigation';
	import { issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import { createApiKey, ApiKeyApiError, type ApiKeyView } from '$lib/api/api-keys';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/send-logs/constants';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import { createApiKeySchema, type CreateApiKeyInput } from 'api/schemas';

	let {
		open = $bindable(false),
		indexIds,
		invalidateKey,
		onCreated
	}: {
		open?: boolean;
		indexIds: string[];
		invalidateKey?: string;
		onCreated?: (summary: ApiKeyView, secret: string) => void;
	} = $props();

	function defaultIndexId() {
		return indexIds.includes(DEFAULT_OTEL_LOGS_INDEX_ID) ? DEFAULT_OTEL_LOGS_INDEX_ID : '';
	}

	let phase = $state<'form' | 'reveal'>('form');
	let name = $state('');
	let indexId = $state('');
	let busy = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let revealedKey = $state('');

	function reset() {
		phase = 'form';
		name = '';
		indexId = defaultIndexId();
		busy = false;
		formError = null;
		fieldErrors = {};
		revealedKey = '';
	}

	$effect(() => {
		if (open) reset();
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(createApiKeySchema, { name, indexId, role: 'ingest' });
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}
		const input: CreateApiKeyInput = parsed.output;

		busy = true;
		try {
			const result = await createApiKey(input);
			revealedKey = result.token;
			phase = 'reveal';
			if (invalidateKey) await invalidate(invalidateKey);
			onCreated?.(result.summary, result.token);
		} catch (err) {
			if (err instanceof ApiKeyApiError && err.body) {
				formError = err.body.error.message;
				fieldErrors = toFieldErrors(err.body);
			} else {
				formError = err instanceof Error ? err.message : 'Failed to create API key';
			}
		} finally {
			busy = false;
		}
	}
</script>

<Modal bind:open title="Create ingest API key" onclose={reset}>
	{#if phase === 'form'}
		<form id="create-api-key-form" class="space-y-3" onsubmit={submit}>
			{#if formError}
				<div role="alert" class="alert alert-error text-sm">{formError}</div>
			{/if}

			<Field
				label="Name"
				placeholder="production-shipper"
				autocomplete="off"
				bind:value={name}
				error={fieldErrors.name}
				required
			/>

			<Field label="Index" error={fieldErrors.indexId}>
				{#snippet control({ id, invalid, describedBy })}
					<select
						{id}
						bind:value={indexId}
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy}
						class="select w-full"
						class:select-error={invalid}
						required
					>
						<option value="" disabled>Select an index…</option>
						{#each indexIds as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				{/snippet}
			</Field>
		</form>
	{:else}
		<div class="flex flex-col gap-3">
			<CopyableField value={revealedKey} ariaLabel="Ingest token" />
		</div>
	{/if}

	{#snippet actions()}
		{#if phase === 'form'}
			<button type="button" class="btn btn-ghost" disabled={busy} onclick={() => (open = false)}>
				Cancel
			</button>
			<button form="create-api-key-form" type="submit" class="btn btn-primary" disabled={busy}>
				{busy ? 'Creating…' : 'Create API key'}
			</button>
		{:else}
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Done</button>
		{/if}
	{/snippet}
</Modal>
