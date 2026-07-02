<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		label: string;
		/** Muted description rendered under the label. Plain text only. */
		hint?: string;
		/** Row-level validation message rendered below the content cell. */
		error?: string;
		/** Explicit control id; falls back to a generated unique id. */
		id?: string;
		/** Render the label as plain text (rows without a single labelable control). */
		plain?: boolean;
		children: Snippet<[{ id: string; invalid: boolean; describedBy: string | undefined }]>;
	};

	let { label, hint, error, id, plain = false, children }: Props = $props();

	const uid = $props.id();
	const controlId = $derived(id ?? uid);
	const msgId = $derived(`${controlId}-msg`);
	const describedBy = $derived(error ? msgId : undefined);
</script>

<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
	<div>
		{#if plain}
			<span class="text-sm">{label}</span>
		{:else}
			<label for={controlId} class="text-sm">{label}</label>
		{/if}
		{#if hint}
			<div class="text-base-content/60 mt-0.5 text-xs">{hint}</div>
		{/if}
	</div>
	<div class="flex flex-col gap-1">
		{@render children({ id: controlId, invalid: !!error, describedBy })}
		{#if error}
			<p id={msgId} class="text-error text-xs">{error}</p>
		{/if}
	</div>
</div>
