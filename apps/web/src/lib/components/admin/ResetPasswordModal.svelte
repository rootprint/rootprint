<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { resetPassword } from '$lib/api/users.remote';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		userId = '',
		userName = '',
		onreset = () => {}
	}: {
		open: boolean;
		userId: string;
		userName: string;
		onreset?: () => void;
	} = $props();

	let loading = $state(false);
	let inviteUrl = $state<string | null>(null);

	async function handleSubmit() {
		loading = true;
		try {
			const result = await resetPassword({ userId });
			inviteUrl = result.inviteUrl;
			onreset();
			toast.success(`Password reset for ${userName}`);
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to reset password'));
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
		inviteUrl = null;
	}
</script>

<Modal bind:open title="Reset Password" onclose={handleClose}>
	{#if inviteUrl === null}
		<p class="mt-2 text-sm text-base-content/60">
			Reset password for <strong>{userName}</strong>? Their current password and active sessions
			will be invalidated. You'll get a new setup link to send them.
		</p>

		<form
			class="mt-4 flex flex-col gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<div class="modal-action">
				<button type="button" class="btn" onclick={handleClose}>Cancel</button>
				<button type="submit" class="btn btn-accent" disabled={loading}>
					{loading ? 'Resetting...' : 'Reset Password'}
				</button>
			</div>
		</form>
	{:else}
		<p class="mt-2 text-sm text-base-content/60">
			Share this setup link with <strong>{userName}</strong>. It expires per invite policy.
		</p>

		<div class="mt-4">
			<CopyableField value={inviteUrl} ariaLabel="Setup link" />
		</div>

		<div class="modal-action">
			<button type="button" class="btn btn-neutral" onclick={handleClose}>Close</button>
		</div>
	{/if}
</Modal>
