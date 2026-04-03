<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { toast } from 'svelte-sonner';

	import { resetPassword } from '$lib/api/users.remote';
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

	let password = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		loading = true;
		try {
			await resetPassword({ userId, _password: password });
			onreset();
			toast.success(`Password reset for ${userName}. They must change it on next login.`);
			handleClose();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to reset password'));
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
		password = '';
	}
</script>

{#if open}
	<div class="modal-open modal">
		<div class="modal-box" transition:scale={{ start: 0.97, duration: 200 }}>
			<h3 class="text-lg font-bold">Reset Password</h3>
			<p class="mt-2 text-sm text-base-content/60">
				Set a temporary password for <strong>{userName}</strong>. They will be required to change it
				on next login.
			</p>

			<form
				class="mt-4 flex flex-col gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<label class="floating-label">
					<span>Temporary Password</span>
					<input
						type="password"
						class="input input-md w-full"
						placeholder="Temporary Password"
						bind:value={password}
						minlength={8}
						required
					/>
				</label>

				<div class="modal-action">
					<button type="button" class="btn" onclick={handleClose}>Cancel</button>
					<button type="submit" class="btn btn-neutral" disabled={loading}>
						{loading ? 'Resetting...' : 'Reset Password'}
					</button>
				</div>
			</form>
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
