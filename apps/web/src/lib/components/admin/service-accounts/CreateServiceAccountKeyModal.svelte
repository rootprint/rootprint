<script lang="ts">
	import * as v from 'valibot';

	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import { createServiceAccountKey } from '$lib/api/api-keys';
	import type { ServiceAccountView } from '$lib/api/service-accounts';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import OneTimeKeyReveal from '$lib/components/ui/OneTimeKeyReveal.svelte';
	import { createServiceAccountKeySchema } from 'api/schemas';

	let {
		open = $bindable(false),
		accounts
	}: { open?: boolean; accounts: Pick<ServiceAccountView, 'id' | 'name'>[] } = $props();

	function initialUserId() {
		return accounts.length === 1 ? accounts[0].id : '';
	}

	let phase = $state<'form' | 'reveal'>('form');
	let name = $state('');
	let userId = $state(initialUserId());
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let revealedKey = $state('');

	function reset() {
		phase = 'form';
		name = '';
		userId = initialUserId();
		submitting = false;
		formError = null;
		fieldErrors = {};
		revealedKey = '';
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(createServiceAccountKeySchema, { name, userId });
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}

		submitting = true;
		try {
			const result = await createServiceAccountKey(parsed.output);
			revealedKey = result.token;
			phase = 'reveal';
			open = true; // re-open if the modal was dismissed mid-request — the one-time token must be shown
			void invalidate(DEP.serviceAccountSettings); // refresh the list and key counts in the background
		} catch (err) {
			if (err instanceof ApiError && err.body) {
				formError = err.body.error.message;
				fieldErrors = toFieldErrors(err.body);
			} else {
				formError = err instanceof Error ? err.message : 'Failed to create service account key';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<Modal
	bind:open
	title="Create service account key"
	onclose={reset}
	oncancel={(e) => {
		if (submitting) e.preventDefault();
	}}
>
	{#if phase === 'form'}
		<form id="create-service-account-key-form" class="space-y-3" {onsubmit}>
			{#if formError}
				<div role="alert" class="alert alert-error text-sm">{formError}</div>
			{/if}

			<Field label="Account" error={fieldErrors.userId}>
				{#snippet control({ id, invalid, describedBy })}
					<select
						{id}
						bind:value={userId}
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy}
						class="select w-full"
						class:select-error={invalid}
						required
					>
						<option value="" disabled>Select a service account…</option>
						{#each accounts as option (option.id)}
							<option value={option.id}>{option.name}</option>
						{/each}
					</select>
				{/snippet}
			</Field>

			<Field
				label="Name"
				placeholder="grafana-integration"
				autocomplete="off"
				bind:value={name}
				error={fieldErrors.name}
				required
			/>
		</form>
	{:else}
		<OneTimeKeyReveal value={revealedKey} ariaLabel="Service account API key" />
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
				form="create-service-account-key-form"
				type="submit"
				class="btn btn-primary"
				disabled={submitting}
			>
				{submitting ? 'Creating…' : 'Create key'}
			</button>
		{:else}
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Done</button>
		{/if}
	{/snippet}
</Modal>
