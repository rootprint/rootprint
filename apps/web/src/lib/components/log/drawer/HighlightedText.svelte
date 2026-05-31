<script lang="ts">
	import { highlightSegments } from '$lib/utils/highlight';

	let {
		text,
		term
	}: {
		text: string;
		term: string;
	} = $props();

	const segments = $derived(highlightSegments(text, term));
</script>

{#each segments as seg}{#if seg.match}<mark
			class="bg-warning/40 text-base-content rounded-sm px-0.5">{seg.text}</mark
		>{:else}{seg.text}{/if}{/each}
