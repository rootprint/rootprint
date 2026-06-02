<script lang="ts">
	import { toast } from 'svelte-sonner';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { authClient } from '$lib/auth-client';

	const MIN_PASSWORD_LENGTH = 8;

	let { open = $bindable(false) }: { open: boolean } = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);

	function reset() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		submitting = false;
		formError = null;
	}

	async function handleSubmit() {
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
			open = false;
		} finally {
			submitting = false;
		}
	}
</script>

<Modal bind:open title="Change password" onclose={reset}>
	<form
		class="flex flex-col gap-3"
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
	>
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
		<!-- Hidden submit so Enter in any field submits (the visible button lives in the modal actions slot, outside this form). -->
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1">Change password</button>
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
		<button type="button" class="btn btn-primary" disabled={submitting} onclick={handleSubmit}>
			{submitting ? 'Saving…' : 'Change password'}
		</button>
	{/snippet}
</Modal>
