<script lang="ts">
	type Window = '24h' | '7d' | '30d';

	type Props = {
		value: Window;
		onChange: (next: Window) => void;
	};

	let { value, onChange }: Props = $props();

	const options: { id: Window; label: string }[] = [
		{ id: '24h', label: '24h' },
		{ id: '7d', label: '7d' },
		{ id: '30d', label: '30d' }
	];
</script>

<div role="tablist" class="join">
	{#each options as opt (opt.id)}
		<button
			role="tab"
			aria-selected={value === opt.id}
			class="btn btn-sm join-item {value === opt.id ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => onChange(opt.id)}
		>
			{opt.label}
		</button>
	{/each}
</div>
