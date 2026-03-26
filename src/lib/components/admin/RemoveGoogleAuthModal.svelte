<script lang="ts">
	import { removeGoogleAuthSettings } from '$lib/api/settings.remote';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { scale, fade } from 'svelte/transition';

	let {
		open = $bindable(false),
		onremove = () => {}
	}: {
		open: boolean;
		onremove?: () => void;
	} = $props();

	let loading = $state(false);

	async function handleSubmit() {
		loading = true;
		try {
			await removeGoogleAuthSettings();
			toast.success('Google auth settings removed');
			onremove();
			await invalidateAll();
			handleClose();
		} catch {
			toast.error('Failed to remove settings');
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
			<h3 class="text-lg font-bold">Remove Google Authentication</h3>
			<p class="mt-2 text-sm text-base-content/60">
				Are you sure you want to remove Google authentication settings? A server restart will be
				required.
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
