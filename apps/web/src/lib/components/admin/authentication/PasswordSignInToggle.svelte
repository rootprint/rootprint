<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { savePasswordSignIn } from '$lib/api/auth-config';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';

	let { enabled }: { enabled: boolean } = $props();

	let confirmOpen = $state(false);
	let saving = $state(false);

	async function save(next: boolean) {
		saving = true;
		try {
			await savePasswordSignIn({ enabled: next });
			toast.success(next ? 'Password sign-in enabled' : 'Password sign-in disabled');
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	function onToggle(el: HTMLInputElement) {
		if (el.checked) {
			save(true).catch((err: unknown) => {
				el.checked = false;
				toast.error(err instanceof Error ? err.message : 'Failed to enable password sign-in');
			});
			return;
		}
		el.checked = true;
		confirmOpen = true;
	}
</script>

<ListCard>
	<div class="flex min-h-14 items-center gap-3 px-4 py-3">
		<div class="min-w-0 flex-1">
			<div class="text-sm">Password sign-in</div>
			<div class="text-muted text-xs">
				Turn off to require an external provider for every sign-in. Invite and password-reset links
				do not provide a sign-in path while disabled.
			</div>
		</div>
		<input
			type="checkbox"
			class="toggle toggle-sm"
			aria-label="Password sign-in"
			checked={enabled}
			disabled={saving}
			onchange={(e) => onToggle(e.currentTarget)}
		/>
	</div>
</ListCard>

<ConfirmModal
	bind:open={confirmOpen}
	title="Disable password sign-in"
	confirmLabel="Disable"
	confirmingLabel="Disabling…"
	errorFallback="Failed to disable password sign-in"
	onConfirm={() => save(false)}
>
	{#snippet message()}
		Users without a linked external account will be unable to sign in. Make sure you can sign in
		with an external provider first, or you may lock yourself out.
	{/snippet}
</ConfirmModal>
