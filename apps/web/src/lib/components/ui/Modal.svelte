<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	let {
		open = $bindable(false),
		title,
		actions,
		children,
		onclose
	}: {
		open: boolean;
		title: string;
		actions?: Snippet;
		children: Snippet;
		onclose?: () => void;
	} = $props();

	function close() {
		onclose?.();
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="modal-open modal">
		<div class="modal-box" transition:scale={{ start: 0.97, duration: 200 }}>
			<h3 class="text-lg font-bold">{title}</h3>
			{@render children()}
			{#if actions}
				<div class="modal-action">
					{@render actions()}
				</div>
			{/if}
		</div>
		<div
			class="modal-backdrop"
			transition:fade={{ duration: 150 }}
			role="button"
			tabindex="-1"
			onclick={close}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') close();
			}}
		>
			<button>close</button>
		</div>
	</div>
{/if}
