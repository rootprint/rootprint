<script lang="ts">
	import { Sparkles, X } from 'lucide-svelte';
	import { whatsNew, version, highlights, openWhatsNew, dismissWhatsNew } from './whats-new.svelte';

	let { collapsed }: { collapsed: boolean } = $props();
</script>

{#if !whatsNew.seen && highlights.length > 0}
	{#if collapsed}
		<button
			type="button"
			onclick={openWhatsNew}
			aria-label="What's new in {version}"
			data-tip="What's new"
			class="text-muted hover:text-base-content hover:bg-base-200/60 tooltip tooltip-right relative mx-2 mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded transition-colors"
		>
			<Sparkles class="size-4" aria-hidden="true" />
			<span class="bg-primary absolute top-2 right-2 size-1.5 rounded-full" aria-hidden="true"
			></span>
		</button>
	{:else}
		<div class="border-line rounded-box relative mx-2 mb-3 shrink-0 border">
			<button
				type="button"
				onclick={openWhatsNew}
				class="hover:bg-base-200/60 rounded-box w-full p-3 pr-9 text-left transition-colors"
			>
				<span class="flex items-center gap-2 text-sm font-medium">
					<Sparkles class="size-4 shrink-0" aria-hidden="true" />
					What's new in {version}
				</span>
				<span class="text-muted mt-0.5 block text-xs">See the release highlights</span>
			</button>
			<button
				type="button"
				onclick={dismissWhatsNew}
				aria-label="Dismiss"
				title="Dismiss"
				class="btn btn-ghost btn-xs btn-square absolute top-2 right-2"
			>
				<X class="size-3" aria-hidden="true" />
			</button>
		</div>
	{/if}
{/if}
