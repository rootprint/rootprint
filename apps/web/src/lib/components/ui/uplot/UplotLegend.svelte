<script lang="ts">
	type Item = { key: string; label: string; color: string; visible: boolean };

	let { items, onToggle }: { items: Item[]; onToggle: (index: number) => void } = $props();
</script>

<div class="flex flex-wrap items-center justify-center gap-4 pt-3">
	{#each items as item, i (item.key)}
		<button
			type="button"
			class="flex items-center gap-1.5 text-xs transition-opacity"
			class:opacity-40={!item.visible}
			aria-pressed={item.visible}
			onclick={() => onToggle(i)}
		>
			<span class="size-2.5 shrink-0 rounded-[2px]" style="background-color: {item.color};"></span>
			<span class="text-muted-foreground">{item.label}</span>
		</button>
	{/each}
</div>
