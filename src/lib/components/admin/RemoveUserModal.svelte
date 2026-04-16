<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { removeUser } from '$lib/api/users.remote';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		userId = '',
		userName = '',
		onremove = () => {}
	}: {
		open: boolean;
		userId: string;
		userName: string;
		onremove?: () => void;
	} = $props();

	let loading = $state(false);

	async function handleConfirm() {
		loading = true;
		try {
			await removeUser({ userId });
			onremove();
			toast.success('User removed');
			open = false;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to remove user'));
		} finally {
			loading = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	bind:loading
	title="Remove User"
	confirmLabel="Remove"
	confirmingLabel="Removing..."
	onConfirm={handleConfirm}
>
	{#snippet message()}
		Are you sure you want to remove <strong>{userName}</strong>? This action cannot be undone.
	{/snippet}
</ConfirmModal>
