<script lang="ts">
	import StepBlock from './StepBlock.svelte';
	import type { Step } from '$lib/send-logs/types';

	let { steps }: { steps: Step[] } = $props();
</script>

<ol class="mt-8 flex flex-col">
	{#each steps as step, i (step.title)}
		<li><StepBlock index={i} {step} isLast={i === steps.length - 1} /></li>
	{/each}
</ol>
