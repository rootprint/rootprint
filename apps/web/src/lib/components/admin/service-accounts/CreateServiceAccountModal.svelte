<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { createServiceAccount } from '$lib/api/service-accounts';
	import { createServiceAccountSchema } from 'api/schemas';
	import Field from '$lib/components/ui/Field.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let name = $state('');
</script>

<FormModal
	bind:open
	title="Create service account"
	submitLabel="Create"
	schema={createServiceAccountSchema}
	values={() => ({ name })}
	onclose={() => (name = '')}
	submit={async (input) => {
		await createServiceAccount(input.name);
		await invalidate(DEP.serviceAccountSettings);
	}}
>
	{#snippet fields(errors)}
		<Field
			label="Display name"
			placeholder="grafana-prod"
			autocomplete="off"
			bind:value={name}
			error={errors.name}
			required
		/>
	{/snippet}
</FormModal>
