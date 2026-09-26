<script lang="ts">
	import { toast } from 'svelte-sonner';

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

	async function onConfirm() {
		await removeUser(userId);
		toast.success(`Removed ${userName}`);
		await onRemoved?.();
	}
</script>

<ConfirmModal
	bind:open
	title="Remove user"
	confirmLabel="Remove"
	confirmingLabel="Removing…"
	errorFallback="Failed to remove user"
	{onConfirm}
>
	{#snippet message()}
		Remove <strong>{userName}</strong>? Their sessions will end immediately. This cannot be undone.
	{/snippet}
</ConfirmModal>
