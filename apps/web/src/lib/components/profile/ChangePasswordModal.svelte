<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';
	import Field from '$lib/components/ui/Field.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import { authClient } from '$lib/auth-client';

	const changePasswordSchema = v.pipe(
		v.object({
			currentPassword: v.pipe(v.string(), v.minLength(1, 'Current password is required.')),
			newPassword: v.pipe(
				v.string(),
				v.minLength(8, 'New password must be at least 8 characters.'),
				v.maxLength(128, 'New password must be at most 128 characters.')
			),
			confirmPassword: v.string()
		}),
		v.forward(
			v.partialCheck(
				[['newPassword'], ['confirmPassword']],
				(input) => input.newPassword === input.confirmPassword,
				'New passwords do not match.'
			),
			['confirmPassword']
		)
	);

	let { open = $bindable(false) }: { open: boolean } = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
</script>

<FormModal
	bind:open
	title="Change password"
	submitLabel="Change password"
	busyLabel="Saving…"
	schema={changePasswordSchema}
	values={() => ({ currentPassword, newPassword, confirmPassword })}
	onclose={() => {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
	}}
	submit={async (input) => {
		const result = await authClient.changePassword({
			currentPassword: input.currentPassword,
			newPassword: input.newPassword,
			revokeOtherSessions: true
		});
		if (result?.error) throw new Error(result.error.message ?? 'Failed to change password.');
		toast.success('Password changed');
	}}
>
	{#snippet fields(errors)}
		<Field
			label="Current password"
			type="password"
			autocomplete="current-password"
			bind:value={currentPassword}
			error={errors.currentPassword}
			required
		/>
		<Field
			label="New password"
			type="password"
			autocomplete="new-password"
			bind:value={newPassword}
			error={errors.newPassword}
			required
		/>
		<Field
			label="Confirm new password"
			type="password"
			autocomplete="new-password"
			bind:value={confirmPassword}
			error={errors.confirmPassword}
			required
		/>
	{/snippet}
</FormModal>
