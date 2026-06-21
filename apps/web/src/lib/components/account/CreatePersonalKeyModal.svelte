<script lang="ts">
	import * as v from 'valibot';

	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { issuesToFieldErrors } from '$lib/api/errors';
	import { authClient } from '$lib/auth-client';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import OneTimeKeyReveal from '$lib/components/ui/OneTimeKeyReveal.svelte';
	import { personalKeyNameSchema } from 'api/schemas';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let phase = $state<'form' | 'reveal'>('form');
	let name = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let revealedKey = $state('');

	function reset() {
		phase = 'form';
		name = '';
		submitting = false;
		formError = null;
		fieldErrors = {};
		revealedKey = '';
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(personalKeyNameSchema, { name });
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}

		submitting = true;
		try {
			const result = await authClient.apiKey.create({ name: parsed.output.name });
			if (result.error) {
				formError = result.error.message ?? 'Failed to create API key.';
				return;
			}
			revealedKey = result.data.key;
			phase = 'reveal';
			open = true; // re-open if dismissed mid-request — the one-time token must be shown
			void invalidate(DEP.personalKeys); // refresh the list in the background
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Failed to create API key.';
		} finally {
			submitting = false;
		}
	}
</script>

<Modal
	bind:open
	title="Create API key"
	onclose={reset}
	oncancel={(e) => {
		if (submitting) e.preventDefault();
	}}
>
	{#if phase === 'form'}
		<form id="create-personal-key-form" class="flex flex-col gap-3" {onsubmit}>
			{#if formError}
				<div role="alert" class="alert alert-error text-sm">{formError}</div>
			{/if}
			<Field
				label="Name"
				placeholder="my-agent"
				autocomplete="off"
				bind:value={name}
				error={fieldErrors.name}
				required
			/>
		</form>
	{:else}
		<OneTimeKeyReveal value={revealedKey} label="API key" />
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
				form="create-personal-key-form"
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
