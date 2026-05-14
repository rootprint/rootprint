<script lang="ts">
	import Icon from '@iconify/svelte';
	import googleIcon from '@iconify-icons/logos/google-icon';

	import type { AuthProviderRow } from '$lib/types';

	let { provider }: { provider: AuthProviderRow } = $props();

	const initial = $derived(provider.name.charAt(0).toUpperCase());
	const badgeClass = $derived(
		provider.configured
			? 'badge-sm badge-success badge-outline'
			: 'badge-sm badge-outline opacity-60'
	);
	const badgeLabel = $derived(provider.configured ? 'Enabled' : 'Not configured');
	const actionLabel = $derived(provider.configured ? 'Edit' : 'Configure');
	const actionClass = $derived(
		provider.configured ? 'btn btn-outline btn-sm' : 'btn btn-accent btn-sm'
	);
</script>

<div
	class="flex min-h-14 items-center gap-3 px-4 py-3 first:rounded-t-box last:rounded-b-box hover:bg-base-200/40"
>
	<div
		class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-base-200 text-xs font-semibold"
		aria-hidden="true"
	>
		{#if provider.id === 'google'}
			<Icon icon={googleIcon} class="h-4 w-4" />
		{:else}
			{initial}
		{/if}
	</div>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<span class="truncate text-sm font-semibold">{provider.name}</span>
			<span class="badge {badgeClass}">{badgeLabel}</span>
		</div>
		<div class="truncate text-xs text-base-content/60">
			{provider.statusLine ?? provider.description}
		</div>
	</div>

	<a class={actionClass} href={provider.editHref}>{actionLabel}</a>
</div>
