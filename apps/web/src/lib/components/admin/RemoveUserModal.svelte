<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { api } from '$lib/api/client';
	import { call } from '$lib/api/call';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let {
		open = $bindable(false),
		userId,
		userName,
		onremoved
	}: {
		open: boolean;
		userId: string;
		userName: string;
		onremoved?: () => void | Promise<void>;
	} = $props();

	let loading = $state(false);

	async function onConfirm() {
		loading = true;
		try {
			await call(api.api.users[':userId'].$delete({ param: { userId } }));
			toast.success(`Removed ${userName}`);
			open = false;
			await onremoved?.();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove user');
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
