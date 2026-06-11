<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import UserIdentity from '$lib/components/ui/UserIdentity.svelte';
	import ChangePasswordModal from '$lib/components/account/ChangePasswordModal.svelte';

	let { data } = $props();

	const sessionUser = $derived(
		page.data.session!.user as unknown as {
			id: string;
			name: string | null;
			email: string;
			role?: string;
		}
	);

	const isAdmin = $derived(sessionUser.role === 'admin');
	let passwordOpen = $state(false);
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader title="Profile" description="Your account details." />

	<div class="mt-8 flex flex-col gap-4">
		<div class="border-line rounded-box bg-base-100 border p-6">
			<UserIdentity
				id={sessionUser.id}
				name={sessionUser.name}
				email={sessionUser.email}
				size="lg"
			/>
		</div>

		{#if data.hasPassword === true}
			<div class="border-line rounded-box flex items-center justify-between border p-6">
				<div>
					<p class="text-sm">Password</p>
					<p class="text-base-content/60 text-xs">Change the password you use to sign in.</p>
				</div>
				<button class="btn btn-sm" onclick={() => (passwordOpen = true)}>Change password</button>
			</div>
		{:else if data.hasPassword === 'unknown'}
			<div class="border-line text-base-content/60 rounded-box border px-6 py-4 text-sm">
				Couldn't determine how you sign in. Reload the page to try again.
			</div>
		{:else}
			<div class="border-line text-base-content/60 rounded-box border px-6 py-4 text-sm">
				Password is managed by your Google account.
			</div>
		{/if}

		{#if isAdmin}
			<a
				href={`/settings/users/${sessionUser.id}`}
				class="text-base-content/60 hover:text-base-content text-sm transition-colors"
			>
				View your activity →
			</a>
		{/if}
	</div>
</div>

<ChangePasswordModal bind:open={passwordOpen} />
