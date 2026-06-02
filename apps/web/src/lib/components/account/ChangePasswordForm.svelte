<script lang="ts">
	import { toast } from 'svelte-sonner';
	import Field from '$lib/components/ui/Field.svelte';
	import { authClient } from '$lib/auth-client';

	const MIN_PASSWORD_LENGTH = 8;

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;

		if (newPassword !== confirmPassword) {
			formError = 'New passwords do not match.';
			return;
		}
		if (newPassword.length < MIN_PASSWORD_LENGTH) {
			formError = `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
			return;
		}

		submitting = true;
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true
			});
			if (result?.error) {
				formError = result.error.message ?? 'Failed to change password.';
				return;
			}
			toast.success('Password changed');
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} finally {
			submitting = false;
		}
	}
</script>

<form class="border-line rounded-box space-y-3 border p-6" {onsubmit}>
	<p class="text-sm">Change password</p>
	{#if formError}
		<div role="alert" class="alert alert-error text-sm">{formError}</div>
	{/if}
	<Field
		label="Current password"
		type="password"
		autocomplete="current-password"
		bind:value={currentPassword}
		required
	/>
	<Field
		label="New password"
		type="password"
		autocomplete="new-password"
		bind:value={newPassword}
		required
	/>
	<Field
		label="Confirm new password"
		type="password"
		autocomplete="new-password"
		bind:value={confirmPassword}
		required
	/>
	<button class="btn btn-primary mt-2" type="submit" disabled={submitting}>
		{submitting ? 'Saving…' : 'Change password'}
	</button>
</form>
