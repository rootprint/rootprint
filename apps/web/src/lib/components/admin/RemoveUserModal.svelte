<script lang="ts">
	import { toast } from 'svelte-sonner';

	import type { ApiErrorBody } from 'api/types';

	import { client } from '$lib/api/client';
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
		const res = await client.api.users[':userId'].$delete({ param: { userId } });
		if (!res.ok) {
			const body = (await res.json()) as ApiErrorBody;
			toast.error(body.error.message);
			loading = false;
			return;
		}
		toast.success(`Removed ${userName}`);
		loading = false;
		open = false;
		await onremoved?.();
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
