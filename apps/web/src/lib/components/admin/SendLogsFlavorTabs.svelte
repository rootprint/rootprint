<script lang="ts" generics="T extends string">
	let {
		tabs,
		current,
		ariaLabel = 'Integration'
	}: {
		tabs: ReadonlyArray<{ id: T; label: string }>;
		current: T;
		ariaLabel?: string;
	} = $props();
</script>

<div role="tablist" aria-label={ariaLabel} class="flex items-center gap-1 border-b border-base-300">
	{#each tabs as tab (tab.id)}
		{@const isActive = tab.id === current}
		<a
			href="?flavor={tab.id}"
			role="tab"
			aria-current={isActive ? 'page' : undefined}
			aria-selected={isActive}
			class={[
				'flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors',
				isActive
					? 'border-base-content font-medium text-base-content'
					: 'border-transparent text-base-content/60 hover:text-base-content'
			]}
		>
			{tab.label}
		</a>
	{/each}
</div>
