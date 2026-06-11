<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { ApiError } from '$lib/api/errors';
	import { removeUser } from '$lib/api/users';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let {
		open = $bindable(false),
		userId,
		userName,
		onRemoved
	}: {
		open: boolean;
		userId: string;
		userName: string;
		onRemoved?: () => void | Promise<void>;
	} = $props();

	let loading = $state(false);

	async function onConfirm() {
		loading = true;
		try {
			await removeUser(userId);
			toast.success(`Removed ${userName}`);
			open = false;
			await onRemoved?.();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'Failed to remove user');
		} finally {
			loading = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	bind:loading
	title="Remove user"
	confirmLabel="Remove"
	confirmingLabel="Removing…"
	{onConfirm}
>
	{#snippet message()}
		Remove <strong>{userName}</strong>? Their sessions will end immediately. This cannot be undone.
	{/snippet}
</ConfirmModal>
