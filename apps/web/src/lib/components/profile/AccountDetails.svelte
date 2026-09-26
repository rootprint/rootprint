<script lang="ts">
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import { formatDate, formatDateTime, formatRelativeTime } from '$lib/utils/time';
	import type { UserStatus } from 'api/types';

	type Props = {
		createdAt: string | Date | null;
		lastActive: string | Date | null;
		status?: UserStatus;
		inviteUrl?: string | null;
		inviteExpiresAt?: string | Date | null;
	};

	let { createdAt, lastActive, status, inviteUrl = null, inviteExpiresAt = null }: Props = $props();

	const joined = $derived(createdAt ? formatDate(createdAt) : 'Unknown');
	const lastActiveLabel = $derived(lastActive ? formatRelativeTime(lastActive) : 'Never');
	const expiresLabel = $derived(inviteExpiresAt ? formatDateTime(inviteExpiresAt) : null);
	const showInvite = $derived(!!inviteUrl && (status === 'pending' || status === 'expired'));

	const statusUi = $derived(
		status === 'expired'
			? { label: 'Invite expired', dot: 'status-error', text: 'text-error' }
			: status === 'pending'
				? { label: 'Invite pending', dot: 'status-warning', text: 'text-base-content' }
				: { label: 'Active', dot: 'status-success', text: 'text-base-content' }
	);
</script>

<div class="flex flex-col gap-4">
	<!-- Read-only facts shown as compact chips so they're legible at a glance. -->
	<dl class="flex flex-wrap items-center gap-2 text-xs">
		<div class="badge badge-sm badge-ghost gap-1.5">
			<dt class="text-muted">Joined</dt>
			<dd class="font-medium">{joined}</dd>
		</div>
		<div class="badge badge-sm badge-ghost gap-1.5">
			<dt class="text-muted">Last active</dt>
			<dd class="font-medium">{lastActiveLabel}</dd>
		</div>
		{#if status}
			<div class="badge badge-sm badge-ghost gap-1.5">
				<dt class="text-muted">Status</dt>
				<dd class="flex items-center gap-1.5 font-medium {statusUi.text}">
					<span class="status {statusUi.dot}" aria-hidden="true"></span>
					{statusUi.label}
				</dd>
			</div>
		{/if}
	</dl>

	{#if showInvite}
		<div class="border-line rounded-box flex flex-col gap-2 border p-4">
			<p class="text-muted text-xs">
				Invite link{expiresLabel ? ` · expires ${expiresLabel}` : ''}
			</p>
			<CopyableField value={inviteUrl!} ariaLabel="Invite link" />
		</div>
	{/if}
</div>
