<script lang="ts">
	import { avatarColor, avatarInitials } from '$lib/utils/avatar';
	import { formatRelativeTime } from '$lib/utils/time';

	type ProfileUser = {
		id: string;
		name: string | null;
		email: string;
		role: string;
		createdAt: string | Date | null;
		lastActive: string | Date | null;
	};

	let { user }: { user: ProfileUser } = $props();

	const initials = $derived(avatarInitials(user.name));
	const color = $derived(avatarColor(user.id));
	const joined = $derived(
		user.createdAt
			? new Date(user.createdAt).toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: 'Unknown'
	);
	const lastActive = $derived(user.lastActive ? formatRelativeTime(user.lastActive) : 'Never');
</script>

<div class="border-line rounded-box border p-6">
	<div class="flex items-center gap-4">
		<span
			class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg text-white"
			style="background: {color}"
		>
			{initials}
		</span>
		<div class="min-w-0">
			<div class="flex items-center gap-2">
				<p class="truncate text-lg">{user.name ?? 'User'}</p>
				{#if user.role === 'admin'}
					<span class="badge badge-sm badge-soft badge-primary text-[10px] tracking-wide uppercase">
						Admin
					</span>
				{:else}
					<span class="text-base-content/50 text-xs">Member</span>
				{/if}
			</div>
			<p class="text-base-content/60 mt-0.5 font-mono text-xs">{user.email}</p>
		</div>
	</div>

	<dl class="mt-6 grid grid-cols-2 gap-4 text-sm">
		<div>
			<dt class="text-base-content/50 text-xs">Joined</dt>
			<dd class="mt-1">{joined}</dd>
		</div>
		<div>
			<dt class="text-base-content/50 text-xs">Last active</dt>
			<dd class="mt-1">{lastActive}</dd>
		</div>
	</dl>
</div>
