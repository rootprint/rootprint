<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { toast } from 'svelte-sonner';

	import { removeUser } from '$lib/api/users.remote';
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

{#if open}
	<div class="modal-open modal">
		<div class="modal-box" transition:scale={{ start: 0.97, duration: 200 }}>
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
		<div
			class="modal-backdrop"
			transition:fade={{ duration: 150 }}
			role="button"
			tabindex="-1"
			onclick={() => (open = false)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') open = false;
			}}
		>
			<button>close</button>
		</div>
	</div>
{/if}
