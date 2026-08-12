<script lang="ts">
	import { Search } from 'lucide-svelte';

	let {
		value = $bindable(''),
		placeholder,
		label,
		class: className = 'flex-1'
	}: {
		value: string;
		placeholder: string;
		label: string;
		class?: string;
	} = $props();
</script>

<label class="input input-sm {className}">
	<Search class="h-3.5 w-3.5 opacity-60" />
	<input type="search" {placeholder} aria-label={label} bind:value />
</label>
