<script lang="ts">
	import * as v from 'valibot';

	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToFieldErrors } from '$lib/api/errors';
	import { createServiceAccount } from '$lib/api/service-accounts';
	import { createServiceAccountSchema } from 'api/schemas';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let name = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	function reset() {
		name = '';
		submitting = false;
		formError = null;
		fieldErrors = {};
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(createServiceAccountSchema, { name });
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}

		submitting = true;
		try {
			await createServiceAccount(parsed.output.name);
			await invalidate(DEP.serviceAccountSettings);
			open = false;
		} catch (err) {
			if (err instanceof ApiError) formError = err.message;
			else formError = err instanceof Error ? err.message : 'Failed to create service account';
		} finally {
			submitting = false;
		}
	}
</script>

<Modal
	bind:open
	title="Create service account"
	onclose={reset}
	oncancel={(e) => {
		if (submitting) e.preventDefault();
	}}
>
	<form id="create-service-account-form" class="space-y-3" {onsubmit}>
		{#if formError}
			<div role="alert" class="alert alert-error text-sm">{formError}</div>
		{/if}
		<Field
			label="Display name"
			placeholder="grafana-prod"
			autocomplete="off"
			bind:value={name}
			error={fieldErrors.name}
			required
		/>
	</form>
	{#snippet actions()}
		<button
			type="button"
			class="btn btn-ghost"
			disabled={submitting}
			onclick={() => (open = false)}
		>
			Cancel
		</button>
		<button
			form="create-service-account-form"
			type="submit"
			class="btn btn-primary"
			disabled={submitting}
		>
			{submitting ? 'Creating…' : 'Create'}
		</button>
	{/snippet}
</Modal>
