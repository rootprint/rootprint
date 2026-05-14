<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { createInvite } from '$lib/api/users.remote';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { UserRole } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		oncreated = () => {}
	}: {
		open: boolean;
		oncreated?: () => void;
	} = $props();

	let email = $state('');
	let name = $state('');
	let role = $state<UserRole>('user');
	let inviteUrl = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		loading = true;
		try {
			const result = await createInvite({ email, name, role });
			inviteUrl = result.inviteUrl;
			oncreated();
			toast.success(`Invite created for ${name}`);
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to create invite'));
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
		email = '';
		name = '';
		role = 'user';
		inviteUrl = '';
	}
</script>

<Modal bind:open title="Invite User" onclose={handleClose}>
	{#if inviteUrl}
		<div class="mt-4 flex flex-col gap-3">
			<p class="text-sm text-base-content/60">
				Share this link with <strong>{name}</strong> to complete their account setup:
			</p>
			<CopyableField value={inviteUrl} ariaLabel="Invite link" />
			<div class="modal-action">
				<button class="btn" onclick={handleClose}>Done</button>
			</div>
		</div>
	{:else}
		<form
			class="mt-4 flex flex-col gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<label class="floating-label">
				<span>Name</span>
				<input
					type="text"
					class="input input-md w-full"
					placeholder="Name"
					bind:value={name}
					required
				/>
			</label>

			<label class="floating-label">
				<span>Email</span>
				<input
					type="email"
					class="input input-md w-full"
					placeholder="Email"
					bind:value={email}
					required
				/>
			</label>

			<label class="form-control w-full">
				<span class="label"><span class="label-text">Role</span></span>
				<select class="select-bordered select w-full" bind:value={role}>
					<option value="user">Member</option>
					<option value="admin">Admin</option>
				</select>
			</label>

			<div class="modal-action">
				<button type="button" class="btn" onclick={handleClose}>Cancel</button>
				<button type="submit" class="btn btn-accent" disabled={loading}>
					{loading ? 'Creating...' : 'Create & Get Link'}
				</button>
			</div>
		</form>
	{/if}
</Modal>
