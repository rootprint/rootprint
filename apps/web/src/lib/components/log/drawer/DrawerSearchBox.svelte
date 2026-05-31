<script lang="ts">
	import { Search, X } from 'lucide-svelte';

	let {
		value = $bindable(''),
		onClose
	}: {
		value?: string;
		onClose: () => void;
	} = $props();

	let inputEl: HTMLInputElement | null = $state(null);

	$effect(() => {
		inputEl?.focus();
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			if (value !== '') {
				value = '';
			} else {
				onClose();
			}
		}
	}
</script>

<div class="border-line bg-base-200/50 flex items-center gap-2 border-b px-3 py-1.5">
	<Search class="text-base-content/50 h-3.5 w-3.5" />
	<input
		bind:this={inputEl}
		bind:value
		type="text"
		placeholder="Search fields and values…"
		class="input input-xs input-ghost min-w-0 flex-1 font-mono"
		onkeydown={handleKeydown}
	/>
	<button
		type="button"
		class="btn btn-ghost btn-xs btn-square"
		aria-label="Close search"
		title="Close search"
		onclick={onClose}
	>
		<X class="h-3 w-3" />
	</button>
</div>
