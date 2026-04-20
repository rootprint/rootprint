<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { IconifyIcon } from '@iconify/types';

	let {
		label,
		icon,
		href
	}: {
		label: string;
		icon: IconifyIcon;
		href: string;
	} = $props();
</script>

<a
	{href}
	class="flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-base-200/40"
>
	<Icon {icon} class="size-5 shrink-0" />
	<span class="flex-1 truncate text-sm font-medium">{label}</span>
</a>
