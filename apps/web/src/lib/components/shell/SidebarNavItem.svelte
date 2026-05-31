<script lang="ts">
	import type { NavItem } from '$lib/settings-nav';

	let {
		href,
		label,
		icon: Icon,
		active,
		collapsed
	}: {
		href: string;
		label: string;
		icon: NavItem['icon'];
		active: boolean;
		collapsed: boolean;
	} = $props();
</script>

<a
	{href}
	aria-current={active ? 'page' : undefined}
	aria-label={collapsed ? label : undefined}
	data-tip={collapsed ? label : undefined}
	class="relative flex items-center rounded text-sm transition-colors {collapsed
		? 'tooltip tooltip-right h-10 w-10 justify-center'
		: 'h-9 gap-2.5 px-3'} {active
		? 'text-base-content bg-base-200'
		: 'text-base-content/60 hover:text-base-content hover:bg-base-200/60'}"
>
	{#if active}
		<span class="bg-primary absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full"></span>
	{/if}
	<Icon class="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
	{#if !collapsed}
		{label}
	{/if}
</a>
