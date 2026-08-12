<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { authClient } from '$lib/auth-client';
	import Field from '$lib/components/ui/Field.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import OneTimeKeyReveal from '$lib/components/ui/OneTimeKeyReveal.svelte';
	import { personalKeyNameSchema } from 'api/schemas';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let name = $state('');
	let revealedKey = $state('');
</script>

<FormModal
	bind:open
	title="Create API key"
	submitLabel="Create key"
	schema={personalKeyNameSchema}
	values={() => ({ name })}
	onclose={() => {
		name = '';
		revealedKey = '';
	}}
	submit={async (input) => {
		const result = await authClient.apiKey.create({ name: input.name });
		if (result.error) throw new Error(result.error.message ?? 'Failed to create API key.');
		revealedKey = result.data.key;
		void invalidate(DEP.personalKeys); // refresh the list in the background
	}}
>
	{#snippet fields(errors)}
		<Field
			label="Name"
			placeholder="my-agent"
			autocomplete="off"
			bind:value={name}
			error={errors.name}
			required
		/>
	{/snippet}
	{#snippet reveal()}
		<OneTimeKeyReveal value={revealedKey} label="API key" />
	{/snippet}
</FormModal>
