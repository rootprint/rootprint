<script lang="ts">
	import { removeUser } from '$lib/api/users.remote';
	import { toast } from 'svelte-sonner';
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

	async function handleSubmit() {
		loading = true;
		try {
			await removeUser({ userId });
			onremove();
			toast.success('User removed');
			handleClose();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to remove user'));
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
	}
</script>

<dialog class="modal" class:modal-open={open}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">Remove User</h3>
		<p class="mt-2 text-sm text-base-content/60">
			Are you sure you want to remove <strong>{userName}</strong>? This action cannot be undone.
		</p>

		<div class="modal-action">
			<button type="button" class="btn" onclick={handleClose}>Cancel</button>
			<button type="button" class="btn btn-error" disabled={loading} onclick={handleSubmit}>
				{loading ? 'Removing...' : 'Remove'}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>
