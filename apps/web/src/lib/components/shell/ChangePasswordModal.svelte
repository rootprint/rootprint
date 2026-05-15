<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { authClient } from '$lib/auth-client';
	import Modal from '$lib/components/ui/Modal.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);

	const mismatch = $derived(confirmPassword.length > 0 && newPassword !== confirmPassword);

	function reset() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		submitting = false;
		formError = null;
	}

	function handleClose() {
		reset();
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		if (mismatch) {
			formError = 'New passwords do not match';
			return;
		}
		if (newPassword.length < 8) {
			formError = 'Password must be at least 8 characters';
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
				formError = result.error.message ?? 'Failed to change password';
				return;
			}
			toast.success('Password changed');
			open = false;
			reset();
		} finally {
			submitting = false;
		}
	}
</script>

<Modal bind:open title="Change password" onclose={handleClose}>
	<form class="flex flex-col gap-3" {onsubmit}>
		{#if formError}
			<div role="alert" class="alert alert-error text-sm">{formError}</div>
		{/if}

		<label class="input w-full">
			<span class="label">Current password</span>
			<input
				bind:value={currentPassword}
				type="password"
				autocomplete="current-password"
				required
			/>
		</label>

		<label class="input w-full">
			<span class="label">New password</span>
			<input
				bind:value={newPassword}
				type="password"
				autocomplete="new-password"
				minlength="8"
				required
			/>
		</label>

		<label class="input w-full" class:input-error={mismatch}>
			<span class="label">Confirm new password</span>
			<input
				bind:value={confirmPassword}
				type="password"
				autocomplete="new-password"
				required
			/>
		</label>
		{#if mismatch}
			<p class="text-error -mt-2 font-mono text-xs">Passwords do not match</p>
		{/if}

		<div class="modal-action">
			<button
				type="button"
				class="btn btn-ghost"
				disabled={submitting}
				onclick={() => (open = false)}
			>
				Cancel
			</button>
			<button class="btn btn-primary" type="submit" disabled={submitting}>
				{submitting ? 'Changing…' : 'Change password'}
			</button>
		</div>
	</form>
</Modal>
