<script lang="ts">
	type ProviderRow = {
		id: 'google';
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
		class="bg-base-200 flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs"
		aria-hidden="true"
	>
		{provider.name.charAt(0)}
	</div>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<span class="truncate text-sm">{provider.name}</span>
			{#if provider.configured}
				<span class="badge badge-outline badge-sm">Enabled</span>
			{:else}
				<span class="badge badge-outline badge-sm opacity-60">Not configured</span>
			{/if}
		</div>
		<div class="text-base-content/60 truncate font-mono text-xs">
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
