<script lang="ts">
	import { resetPassword } from '$lib/api/users.remote';
	import { toast } from 'svelte-sonner';
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

<dialog class="modal" class:modal-open={open}>
	<div class="modal-box">
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
					type="text"
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
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>
