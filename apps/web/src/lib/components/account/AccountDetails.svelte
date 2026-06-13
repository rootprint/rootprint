<script lang="ts">
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import { formatDate, formatDateTime, formatRelativeTime } from '$lib/utils/time';
	import type { UserStatus } from 'api/types';

	type Props = {
		createdAt: string | Date | null;
		lastActive: string | Date | null;
		hasCredentialAccount: boolean;
		status?: UserStatus;
		inviteUrl?: string | null;
		inviteExpiresAt?: string | Date | null;
	};

	let {
		createdAt,
		lastActive,
		hasCredentialAccount,
		status,
		inviteUrl = null,
		inviteExpiresAt = null
	}: Props = $props();

	const joined = $derived(createdAt ? formatDate(createdAt) : 'Unknown');
	const lastActiveLabel = $derived(lastActive ? formatRelativeTime(lastActive) : 'Never');
	const authMethod = $derived(hasCredentialAccount ? 'Password' : 'Single sign-on');
	const expiresLabel = $derived(inviteExpiresAt ? formatDateTime(inviteExpiresAt) : null);
	const showInvite = $derived(!!inviteUrl && (status === 'pending' || status === 'expired'));

	const statusUi = $derived(
		status === 'expired'
			? { label: 'Invite expired', dot: 'bg-error', text: 'text-error' }
			: status === 'pending'
				? { label: 'Invite pending', dot: 'bg-warning', text: 'text-base-content/90' }
				: { label: 'Active', dot: 'bg-success', text: 'text-base-content/90' }
	);
</script>

<div class="flex flex-col gap-4">
	<!-- Read-only facts shown as compact chips so they're legible at a glance. -->
	<dl class="flex flex-wrap items-center gap-2 text-xs">
		<div class="bg-base-200 flex items-center gap-1.5 rounded-full px-3 py-1">
			<dt class="text-base-content/50">Joined</dt>
			<dd class="text-base-content/90 font-medium">{joined}</dd>
		</div>
		<div class="bg-base-200 flex items-center gap-1.5 rounded-full px-3 py-1">
			<dt class="text-base-content/50">Auth</dt>
			<dd class="text-base-content/90 font-medium">{authMethod}</dd>
		</div>
		<div class="bg-base-200 flex items-center gap-1.5 rounded-full px-3 py-1">
			<dt class="text-base-content/50">Last active</dt>
			<dd class="text-base-content/90 font-medium">{lastActiveLabel}</dd>
		</div>
		{#if status}
			<div class="bg-base-200 flex items-center gap-1.5 rounded-full px-3 py-1">
				<dt class="text-base-content/50">Status</dt>
				<dd class="flex items-center gap-1.5 font-medium {statusUi.text}">
					<span class="h-1.5 w-1.5 rounded-full {statusUi.dot}" aria-hidden="true"></span>
					{statusUi.label}
				</dd>
			</div>
		{/if}
	</dl>

	{#if showInvite}
		<div class="border-line rounded-box flex flex-col gap-2 border p-4">
			<p class="text-base-content/50 text-xs">
				Invite link{expiresLabel ? ` · expires ${expiresLabel}` : ''}
			</p>
			<CopyableField value={inviteUrl!} ariaLabel="Invite link" />
		</div>
	{/if}
</div>
