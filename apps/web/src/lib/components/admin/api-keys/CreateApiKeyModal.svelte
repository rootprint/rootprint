<script lang="ts">
	import * as v from 'valibot';
	import { invalidate } from '$app/navigation';
	import { ApiError, issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import { createApiKey, type ApiKeyView } from '$lib/api/api-keys';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import OneTimeKeyReveal from '$lib/components/ui/OneTimeKeyReveal.svelte';
	import { createApiKeySchema, type CreateApiKeyInput } from 'api/schemas';

	let {
		open = $bindable(false),
		indexIds,
		defaultIndexId,
		invalidateKey,
		onCreated
	}: {
		open?: boolean;
		indexIds: string[];
		/** Preselected index; ignored when not present in `indexIds`. */
		defaultIndexId?: string;
		invalidateKey?: string;
		onCreated?: (summary: ApiKeyView, secret: string) => void;
	} = $props();

	function initialIndexId() {
		if (defaultIndexId !== undefined && indexIds.includes(defaultIndexId)) return defaultIndexId;
		return indexIds.length === 1 ? indexIds[0] : '';
	}

	let phase = $state<'form' | 'reveal'>('form');
	let name = $state('');
	let indexId = $state(initialIndexId());
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let revealedKey = $state('');

	function reset() {
		phase = 'form';
		name = '';
		indexId = initialIndexId();
		submitting = false;
		formError = null;
		fieldErrors = {};
		revealedKey = '';
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(createApiKeySchema, { name, indexId });
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}
		const input: CreateApiKeyInput = parsed.output;

		submitting = true;
		try {
			const result = await createApiKey(input);
			if (invalidateKey) await invalidate(invalidateKey);
			onCreated?.(result.summary, result.token);
			if (!open) return;
			revealedKey = result.token;
			phase = 'reveal';
		} catch (err) {
			if (err instanceof ApiError && err.body) {
				formError = err.body.error.message;
				fieldErrors = toFieldErrors(err.body);
			} else {
				formError = err instanceof Error ? err.message : 'Failed to create API key';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<Modal
	bind:open
	title="Create ingest key"
	onclose={reset}
	oncancel={(e) => {
		if (submitting) e.preventDefault();
	}}
>
	{#if phase === 'form'}
		<form id="create-api-key-form" class="space-y-3" {onsubmit}>
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
		<OneTimeKeyReveal value={revealedKey} label="Ingest key" />
	{/if}

	{#snippet actions()}
		{#if phase === 'form'}
			<button
				type="button"
				class="btn btn-ghost"
				disabled={submitting}
				onclick={() => (open = false)}
			>
				Cancel
			</button>
			<button
				form="create-api-key-form"
				type="submit"
				class="btn btn-primary"
				disabled={submitting}
			>
				{submitting ? 'Creating…' : 'Create ingest key'}
			</button>
		{:else}
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Done</button>
		{/if}
	{/snippet}
</Modal>
