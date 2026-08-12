<script lang="ts">
	import Field from './Field.svelte';

	let {
		label,
		value = $bindable(''),
		options,
		placeholder,
		error
	}: {
		label: string;
		value?: string;
		options: { value: string; label: string }[];
		/** Renders a disabled empty-value option first, for a required unset select. */
		placeholder?: string;
		error?: string;
	} = $props();
</script>

<Field {label} {error}>
	{#snippet control({ id, invalid, describedBy })}
		<select
			{id}
			bind:value
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={describedBy}
			class="select w-full"
			class:select-error={invalid}
			required
		>
			{#if placeholder}
				<option value="" disabled>{placeholder}</option>
			{/if}
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{/snippet}
</Field>
