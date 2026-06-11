<script lang="ts">
	import * as v from 'valibot';
	import { invalidate } from '$app/navigation';
	import { ApiError, issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import { createApiKey, type ApiKeyView } from '$lib/api/api-keys';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import { createApiKeySchema, type CreateApiKeyInput } from 'api/schemas';
	import type { ApiKeyRole } from 'api/types';

	let {
		open = $bindable(false),
		indexIds,
		role,
		defaultIndexId,
		invalidateKey,
		onCreated
	}: {
		open?: boolean;
		indexIds: string[];
		/** Fixed role for the new key; omit to let the user pick one in the form. */
		role?: ApiKeyRole;
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
	let selectedRole = $state<ApiKeyRole | ''>('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let revealedKey = $state('');

	function reset() {
		phase = 'form';
		name = '';
		indexId = initialIndexId();
		selectedRole = '';
		submitting = false;
		formError = null;
		fieldErrors = {};
		revealedKey = '';
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(createApiKeySchema, {
			name,
			indexId,
			role: role ?? selectedRole
		});
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}
		const input: CreateApiKeyInput = parsed.output;

		submitting = true;
		try {
			const result = await createApiKey(input);
			revealedKey = result.token;
			phase = 'reveal';
			if (invalidateKey) await invalidate(invalidateKey);
			onCreated?.(result.summary, result.token);
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

	const title = $derived(role === undefined ? 'Create API key' : `Create ${role} API key`);
	const tokenLabel = $derived(
		(role ?? selectedRole) === 'search' ? 'Search token' : 'Ingest token'
	);
</script>

<Modal bind:open {title} onclose={reset}>
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

			{#if role === undefined}
				<fieldset class="space-y-1.5">
					<legend class="field-label">Role</legend>
					<div class="flex gap-4">
						<label class="label cursor-pointer gap-2">
							<input
								type="radio"
								name="role"
								class="radio radio-sm"
								value="ingest"
								bind:group={selectedRole}
								required
							/>
							<span>Ingest</span>
						</label>
						<label class="label cursor-pointer gap-2">
							<input
								type="radio"
								name="role"
								class="radio radio-sm"
								value="search"
								bind:group={selectedRole}
							/>
							<span>Search</span>
						</label>
					</div>
					{#if fieldErrors.role}
						<p class="text-error text-xs">{fieldErrors.role}</p>
					{/if}
				</fieldset>
			{/if}
		</form>
	{:else}
		<div class="flex flex-col gap-3">
			<CopyableField value={revealedKey} ariaLabel={tokenLabel} />
		</div>
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
				{submitting ? 'Creating…' : 'Create API key'}
			</button>
		{:else}
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Done</button>
		{/if}
	{/snippet}
</Modal>
