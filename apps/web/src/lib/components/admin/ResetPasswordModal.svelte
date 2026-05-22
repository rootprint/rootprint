<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { resetUserPassword, UserApiError } from '$lib/api/users';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	let {
		open = $bindable(false),
		userId,
		userName,
		onreset
	}: {
		open: boolean;
		userId: string;
		userName: string;
		onreset?: () => void | Promise<void>;
	} = $props();

	let loading = $state(false);
	let inviteUrl = $state<string | null>(null);

	function handleClose() {
		inviteUrl = null;
		loading = false;
	}

	async function handleConfirm() {
		loading = true;
		try {
			const result = await resetUserPassword(userId);
			inviteUrl = result.inviteUrl;
			toast.success(`Password reset for ${userName}`);
			await onreset?.();
		} catch (e) {
			toast.error(e instanceof UserApiError ? e.message : 'Failed to reset password');
		} finally {
			loading = false;
		}
	}
</script>

<Modal bind:open title="Reset password" onclose={handleClose}>
	{#if inviteUrl === null}
		<p class="text-base-content/70 text-sm">
			Reset password for <strong>{userName}</strong>? Their current password and active sessions
			will be invalidated, and you'll get a one-time setup link to share with them.
		</p>
		<div class="modal-action">
			<button
				type="button"
				class="btn btn-ghost"
				disabled={loading}
				onclick={() => (open = false)}
			>
				Cancel
			</button>
			<button type="button" class="btn btn-primary" disabled={loading} onclick={handleConfirm}>
				{loading ? 'Resetting…' : 'Reset password'}
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			<p class="text-base-content/70 text-sm">
				Share this setup link with <strong>{userName}</strong>. It expires per the invite policy.
			</p>
			<CopyableField value={inviteUrl} ariaLabel="Setup link" />
		</div>
		<div class="modal-action">
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Close</button>
		</div>
	{/if}
</Modal>
