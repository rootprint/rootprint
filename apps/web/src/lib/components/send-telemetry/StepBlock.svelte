<script lang="ts">
	import { Search } from 'lucide-svelte';
	import CodeBlock from './CodeBlock.svelte';
	import Callout from './Callout.svelte';
	import type { Step } from '$lib/send-telemetry/types';

	let { index, step, isLast }: { index: number; step: Step; isLast: boolean } = $props();

	const indexLabel = $derived(String(index + 1).padStart(2, '0'));
	const hasTrailingGutter = $derived(!isLast || !!step.verify);
</script>

<div class="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 {isLast ? '' : 'pb-8'}">
	<div class="flex flex-col items-center">
		<p class="section-label">[{indexLabel}]</p>
		{#if hasTrailingGutter}
			<div class="bg-line mt-2 w-px flex-1"></div>
		{/if}
	</div>
	<div class="flex flex-col gap-3 {step.verify ? 'pb-2' : ''}">
		<p class="section-label">{step.title}</p>
		{#if step.body}
			<p class="text-muted">{step.body}</p>
		{/if}
		{#if step.linkOut}
			<div>
				<a
					href={step.linkOut.href}
					target="_blank"
					rel="noreferrer"
					class="btn btn-sm btn-primary gap-2"
				>
					{step.linkOut.label}
				</a>
			</div>
		{/if}
		{#if step.snippets}
			{#each step.snippets as snippet (snippet.code)}
				<CodeBlock
					code={snippet.code}
					lang={snippet.lang}
					copyTitle={snippet.copyTitle}
					highlightValue={snippet.highlightValue}
				/>
			{/each}
		{/if}
		{#if step.callout}
			<Callout variant={step.callout.variant}>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html step.callout.html}
			</Callout>
		{/if}
	</div>

	{#if step.verify}
		<div class="flex flex-col items-center">
			<div class="bg-line w-px flex-1"></div>
			<p class="section-label">[-&gt;]</p>
			<div class="flex-1"></div>
		</div>
		<div class="flex items-center">
			<a href={step.verify.href} class="btn btn-primary btn-sm gap-2">
				<Search class="size-3.5" aria-hidden="true" />
				{step.verify.label}
			</a>
		</div>
	{/if}
</div>
