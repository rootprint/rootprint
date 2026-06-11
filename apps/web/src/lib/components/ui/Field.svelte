<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'value'> & {
		label: string;
		value?: string;
		error?: string;
		hint?: string;
		/** Render a custom control (e.g. a <select>) instead of the built-in <input>. */
		control?: Snippet<[{ id: string; invalid: boolean; describedBy: string | undefined }]>;
	};

	let { label, value = $bindable(''), error, hint, id, control, ...rest }: Props = $props();

	const uid = $props.id();
	const inputId = $derived(id ?? uid);
	const msgId = $derived(`${inputId}-msg`);
	const describedBy = $derived(error || hint ? msgId : undefined);
</script>

<div class="space-y-1.5">
	<label for={inputId} class="field-label">{label}</label>
	{#if control}
		{@render control({ id: inputId, invalid: !!error, describedBy })}
	{:else}
		<input
			{...rest}
			id={inputId}
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			class="input w-full"
			class:input-error={!!error}
		/>
	{/if}
	{#if error}
		<p id={msgId} class="text-error text-xs">{error}</p>
	{:else if hint}
		<p id={msgId} class="text-base-content/50 text-xs">{hint}</p>
	{/if}
</div>
