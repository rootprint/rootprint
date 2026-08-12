<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { resetUserPassword } from '$lib/api/users';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';

	let {
		open = $bindable(false),
		userId,
		userName,
		onReset
	}: {
		open: boolean;
		userId: string;
		userName: string;
		onReset?: () => void | Promise<void>;
	} = $props();

	let inviteUrl = $state<string | null>(null);

	async function submit() {
		const result = await resetUserPassword(userId);
		inviteUrl = result.inviteUrl;
		toast.success(`Password reset for ${userName}`);
		await onReset?.();
	}
</script>

<FormModal
	bind:open
	title="Reset password"
	submitLabel="Reset password"
	busyLabel="Resetting…"
	schema={v.object({})}
	values={() => ({})}
	{submit}
	onclose={() => (inviteUrl = null)}
>
	{#snippet fields()}
		<p class="text-base-content/60 text-sm">
			Reset password for <strong>{userName}</strong>? Their current password and active sessions
			will be invalidated, and you'll get a one-time setup link to share with them.
		</p>
	{/snippet}

	{#snippet reveal()}
		<div class="flex flex-col gap-3">
			<p class="text-base-content/60 text-sm">
				Share this setup link with <strong>{userName}</strong>. It expires per the invite policy.
			</p>
			<CopyableField value={inviteUrl ?? ''} ariaLabel="Setup link" />
		</div>
	{/snippet}
</FormModal>
