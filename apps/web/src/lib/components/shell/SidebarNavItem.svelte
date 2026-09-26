<script lang="ts">
	import type { NavItem } from '$lib/admin-nav';

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
	data-tip={collapsed ? label : ''}
	class="nav-rail tooltip tooltip-right flex items-center rounded text-sm transition-colors {collapsed
		? 'h-10 w-10 justify-center'
		: 'h-9 gap-2.5 px-3'} {active
		? 'text-base-content bg-base-200'
		: 'text-muted hover:text-base-content hover:bg-base-200/60'}"
>
	<span class="nav-rail-bar"></span>
	<Icon class="size-4 shrink-0" aria-hidden="true" />
	{#if !collapsed}
		{label}
	{/if}
</a>
