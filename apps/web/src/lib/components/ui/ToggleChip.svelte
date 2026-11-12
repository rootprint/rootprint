<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		pressed,
		class: className,
		children,
		...rest
	}: Omit<HTMLButtonAttributes, 'type' | 'aria-pressed' | 'children'> & {
		pressed: boolean;
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	class={[
		'border-line inline-flex items-center rounded border px-2 py-0.5 text-xs transition-colors',
		pressed ? 'bg-base-content text-base-100' : 'text-muted hover:bg-base-200',
		className
	]}
	aria-pressed={pressed}
	{...rest}
>
	{@render children()}
</button>
