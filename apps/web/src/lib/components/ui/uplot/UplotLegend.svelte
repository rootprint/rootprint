<script lang="ts">
	type Item = { key: string; label: string; color: string; visible: boolean };

	let {
		items,
		onToggle,
		inline = false
	}: { items: Item[]; onToggle: (index: number) => void; inline?: boolean } = $props();
</script>

<div
	class={['flex flex-wrap items-center', inline ? 'gap-x-3 gap-y-1' : 'justify-center gap-4 pt-3']}
>
	{#each items as item, i (item.key)}
		<button
			type="button"
			class="text-muted flex items-center gap-1.5 text-xs"
			class:line-through={!item.visible}
			aria-pressed={item.visible}
			onclick={() => onToggle(i)}
		>
			<span
				class="size-2.5 shrink-0 rounded-[2px]"
				class:opacity-40={!item.visible}
				style="background-color: {item.color};"
			></span>
			<span>{item.label}</span>
		</button>
	{/each}
</div>
