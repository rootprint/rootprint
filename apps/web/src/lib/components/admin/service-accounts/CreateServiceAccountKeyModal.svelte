<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { createServiceAccountKey } from '$lib/api/api-keys';
	import type { ServiceAccountView } from '$lib/api/service-accounts';
	import Field from '$lib/components/ui/Field.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import OneTimeKeyReveal from '$lib/components/ui/OneTimeKeyReveal.svelte';
	import SelectField from '$lib/components/ui/SelectField.svelte';
	import { createServiceAccountKeySchema } from 'api/schemas';

	let {
		open = $bindable(false),
		accounts
	}: { open?: boolean; accounts: Pick<ServiceAccountView, 'id' | 'name'>[] } = $props();

	function initialUserId() {
		return accounts.length === 1 ? accounts[0].id : '';
	}

	let name = $state('');
	let userId = $state(initialUserId());
	let revealedKey = $state('');
</script>

<FormModal
	bind:open
	title="Create service account key"
	submitLabel="Create key"
	schema={createServiceAccountKeySchema}
	values={() => ({ name, userId })}
	onclose={() => {
		name = '';
		userId = initialUserId();
		revealedKey = '';
	}}
	submit={async (input) => {
		const result = await createServiceAccountKey(input);
		revealedKey = result.token;
		void invalidate(DEP.serviceAccountSettings); // refresh the list and key counts in the background
	}}
>
	{#snippet fields(errors)}
		<SelectField
			label="Account"
			bind:value={userId}
			options={accounts.map((a) => ({ value: a.id, label: a.name }))}
			placeholder="Select a service account…"
			error={errors.userId}
		/>
		<Field
			label="Name"
			placeholder="grafana-integration"
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
