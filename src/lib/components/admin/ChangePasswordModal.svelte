<script lang="ts">
	import { changeOwnPassword } from '$lib/api/auth.remote';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';
	import { scale, fade } from 'svelte/transition';

	let {
		open = $bindable(false)
	}: {
		open: boolean;
	} = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let passwordMismatch = $derived(confirmPassword.length > 0 && newPassword !== confirmPassword);

	async function handleSubmit() {
		loading = true;
		try {
			await changeOwnPassword({
				_currentPassword: currentPassword,
				_password: newPassword,
				_confirmPassword: confirmPassword
			});
			toast.success('Password changed successfully');
			handleClose();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to change password'));
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
	}
</script>

{#if open}
	<div class="modal-open modal">
		<div class="modal-box" transition:scale={{ start: 0.97, duration: 200 }}>
			<h3 class="text-lg font-bold">Change Password</h3>

			<form
				class="mt-4 flex flex-col gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<label class="floating-label">
					<span>Current Password</span>
					<input
						type="password"
						class="input input-md w-full"
						placeholder="Current Password"
						bind:value={currentPassword}
						required
					/>
				</label>

				<label class="floating-label">
					<span>New Password</span>
					<input
						type="password"
						class="input input-md w-full"
						placeholder="New Password"
						bind:value={newPassword}
						minlength={8}
						required
					/>
				</label>

				<label class="floating-label">
					<span>Confirm New Password</span>
					<input
						type="password"
						class="input input-md w-full"
						class:input-error={passwordMismatch}
						placeholder="Confirm New Password"
						bind:value={confirmPassword}
						minlength={8}
						required
					/>
					{#if passwordMismatch}
						<p class="mt-1 text-sm text-error">Passwords do not match</p>
					{/if}
				</label>

				<div class="modal-action">
					<button type="button" class="btn" onclick={handleClose}>Cancel</button>
					<button type="submit" class="btn btn-neutral" disabled={loading || passwordMismatch}>
						{loading ? 'Changing...' : 'Change Password'}
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
