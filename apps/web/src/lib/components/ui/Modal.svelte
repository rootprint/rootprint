<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		busy = false,
		actions,
		children,
		onclose
	}: {
		open?: boolean;
		title: string;
		busy?: boolean;
		actions?: Snippet;
		children: Snippet;
		onclose?: () => void;
	} = $props();

	const uid = $props.id();
	const titleId = `modal-title-${uid}`;

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function handleClose() {
		open = false;
		onclose?.();
	}
</script>

<dialog
	bind:this={dialog}
	class="modal"
	aria-labelledby={titleId}
	onclose={handleClose}
	oncancel={(e) => {
		if (busy) e.preventDefault();
	}}
>
	<div
		class="modal-box border-line rounded-box bg-base-100 max-w-lg overflow-x-hidden border shadow-none"
	>
		<h3 id={titleId} class="text-lg tracking-tight">{title}</h3>
		<div class="mt-4">
			{@render children()}
		</div>
		{#if actions}
			<div class="modal-action mt-6">
				{@render actions()}
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close" disabled={busy}>close</button>
	</form>
</dialog>
