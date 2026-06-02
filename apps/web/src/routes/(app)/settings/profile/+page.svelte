<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import ProfileCard from '$lib/components/account/ProfileCard.svelte';
	import ChangePasswordForm from '$lib/components/account/ChangePasswordForm.svelte';

	let { data } = $props();

	const sessionUser = $derived(
		page.data.session!.user as unknown as {
			id: string;
			name: string | null;
			email: string;
			role?: string;
			createdAt: string | Date | null;
			lastActive: string | Date | null;
		}
	);

	const user = $derived({
		id: sessionUser.id,
		name: sessionUser.name,
		email: sessionUser.email,
		role: sessionUser.role ?? 'user',
		createdAt: sessionUser.createdAt ?? null,
		lastActive: sessionUser.lastActive ?? null
	});
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader title="Profile" description="Your account details." />

	<div class="mt-8 flex flex-col gap-4">
		<ProfileCard {user} />
		{#if data.hasPassword}
			<ChangePasswordForm />
		{:else}
			<div class="border-line text-base-content/60 rounded-box border px-6 py-4 text-sm">
				Password is managed by your Google account.
			</div>
		{/if}
	</div>
</div>
