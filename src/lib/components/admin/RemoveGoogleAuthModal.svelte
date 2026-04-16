<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { removeGoogleAuthSettings } from '$lib/api/settings.remote';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let {
		open = $bindable(false),
		onremove = () => {}
	}: {
		open: boolean;
		onremove?: () => void;
	} = $props();

	let loading = $state(false);

	async function handleConfirm() {
		loading = true;
		try {
			await removeGoogleAuthSettings();
			toast.success('Google auth settings removed');
			onremove();
			await invalidateAll();
			open = false;
		} catch {
			toast.error('Failed to remove settings');
		} finally {
			loading = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	bind:loading
	title="Remove Google Authentication"
	confirmLabel="Remove"
	confirmingLabel="Removing..."
	onConfirm={handleConfirm}
>
	{#snippet message()}
		Are you sure you want to remove Google authentication settings? A server restart will be
		required.
	{/snippet}
</ConfirmModal>
