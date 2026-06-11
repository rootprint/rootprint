<script lang="ts">
	import GoogleIcon from '@iconify-svelte/logos/google-icon';
	import GitHubIcon from '@iconify-svelte/logos/github-icon';
	type ProviderRow = {
		id: 'google' | 'github';
		name: string;
		description: string;
		statusLine: string | null;
		configured: boolean;
		editHref: string;
	};

	let { provider }: { provider: ProviderRow } = $props();
</script>

<div class="flex min-h-14 items-center gap-3 px-4 py-3">
	<div
		class="border-line bg-base-100 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
		aria-hidden="true"
	>
		{#if provider.id === 'google'}
			<GoogleIcon class="h-5 w-5" />
		{:else if provider.id === 'github'}
			<GitHubIcon class="h-5 w-5" />
		{:else}
			<span class="text-xs">{provider.name.charAt(0)}</span>
		{/if}
	</div>

	<div class="min-w-0 flex-1">
		<div class="truncate text-sm">{provider.name}</div>
		<div class="text-base-content/60 truncate text-xs">
			{provider.statusLine ?? provider.description}
		</div>
	</div>

	<a
		class="btn btn-sm {provider.configured ? 'btn-ghost' : 'btn-primary'}"
		href={provider.editHref}
	>
		{provider.configured ? 'Edit' : 'Configure'}
	</a>
</div>
