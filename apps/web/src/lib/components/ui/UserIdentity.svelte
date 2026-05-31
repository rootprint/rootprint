<script lang="ts">
	import { avatarColor, avatarInitials } from '$lib/utils/avatar';

	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		id: string;
		name: string | null;
		email?: string | null;
		size?: Size;
		href?: string | null;
	};

	let { id, name, email = null, size = 'md', href = null }: Props = $props();

	const display = $derived(name ?? email ?? id);

	const sizes: Record<Size, { box: string; circle: string; name: string; email: string }> = {
		sm: {
			box: 'gap-2',
			circle: 'h-7 w-7 text-[10px]',
			name: 'text-sm',
			email: 'font-mono text-[11px]'
		},
		md: {
			box: 'gap-3',
			circle: 'h-9 w-9 text-xs',
			name: 'text-sm',
			email: 'font-mono text-xs'
		},
		lg: {
			box: 'gap-4',
			circle: 'h-14 w-14 text-base',
			name: 'text-2xl',
			email: 'font-mono text-xs'
		}
	};
	const cls = $derived(sizes[size]);
</script>

{#snippet inner()}
	<div
		class="{cls.circle} flex shrink-0 items-center justify-center rounded-full text-white"
		style="background: {avatarColor(id)}"
		aria-hidden="true"
	>
		{avatarInitials(display)}
	</div>
	<div class="min-w-0">
		<div class="{cls.name} truncate">{display}</div>
		{#if email && email !== display}
			<div class="{cls.email} text-base-content/60 truncate">{email}</div>
		{/if}
	</div>
{/snippet}

{#if href}
	<a {href} class="flex min-w-0 items-center {cls.box} hover:opacity-80">
		{@render inner()}
	</a>
{:else}
	<div class="flex min-w-0 items-center {cls.box}">
		{@render inner()}
	</div>
{/if}
