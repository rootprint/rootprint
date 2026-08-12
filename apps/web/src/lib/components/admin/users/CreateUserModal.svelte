<script lang="ts">
	import { createUser } from '$lib/api/users';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import SelectField from '$lib/components/ui/SelectField.svelte';
	import { createUserSchema } from 'api/schemas';

	let {
		open = $bindable(false),
		onCreated
	}: {
		open: boolean;
		onCreated?: () => void | Promise<void>;
	} = $props();

	let name = $state('');
	let email = $state('');
	let role = $state('user');
	let inviteUrl = $state<string | null>(null);
</script>

<FormModal
	bind:open
	title="Create user"
	submitLabel="Create & get link"
	schema={createUserSchema}
	values={() => ({ name, email, role })}
	onclose={() => {
		name = '';
		email = '';
		role = 'user';
		inviteUrl = null;
	}}
	submit={async (input) => {
		const result = await createUser(input);
		inviteUrl = result.inviteUrl;
		void onCreated?.(); // refresh the user list in the background
	}}
>
	{#snippet fields(errors)}
		<Field
			label="Name"
			placeholder="Ada Lovelace"
			autocomplete="off"
			bind:value={name}
			error={errors.name}
			required
		/>

		<Field
			label="Email"
			type="email"
			placeholder="you@company.com"
			autocomplete="off"
			bind:value={email}
			error={errors.email}
			required
		/>

		<SelectField
			label="Role"
			bind:value={role}
			options={[
				{ value: 'user', label: 'Member' },
				{ value: 'admin', label: 'Admin' }
			]}
			error={errors.role}
		/>
	{/snippet}
	{#snippet reveal()}
		<div class="flex flex-col gap-3">
			<p class="text-base-content/60 text-sm">
				Share this link with <strong>{name}</strong> to complete account setup.
			</p>
			<CopyableField value={inviteUrl ?? ''} ariaLabel="Invite link" />
		</div>
	{/snippet}
</FormModal>
