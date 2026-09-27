<script lang="ts">
	import { CircleHelp, BookOpen, Sparkles, Tag } from 'lucide-svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { whatsNew, version, highlights, openWhatsNew } from './whats-new.svelte';

	let { collapsed = false }: { collapsed?: boolean } = $props();

	const GITHUB = 'https://github.com/rootprint/rootprint';
	const DOCS = 'https://docs.rootprint.io';
	const CHANGELOG = `${GITHUB}/blob/main/CHANGELOG.md`;
	const RELEASE_NOTES = `${GITHUB}/releases/tag/v${version}`;

	const links = [
		{ href: DOCS, label: 'Documentation', icon: BookOpen },
		{ href: CHANGELOG, label: 'Changelog', icon: Tag }
	];

	const dd = $props.id();
	let panelEl = $state<HTMLUListElement | null>(null);
	// The dialog's opener is gone by the time it closes (the card is dismissed, the menu hidden),
	// so focus goes back to the Help button.
	let triggerEl = $state<HTMLButtonElement | null>(null);
</script>

<button
	bind:this={triggerEl}
	type="button"
	popovertarget={dd}
	style="anchor-name:--{dd}"
	aria-label="Help"
	data-tip={collapsed ? 'Help' : ''}
	class="text-muted hover:text-base-content hover:bg-base-200/60 tooltip tooltip-right flex items-center rounded text-sm transition-colors {collapsed
		? 'h-10 w-10 justify-center'
		: 'h-9 gap-2.5 px-3'}"
>
	<CircleHelp class="size-4 shrink-0" aria-hidden="true" />
	{#if !collapsed}
		Help
	{/if}
</button>

<ul
	bind:this={panelEl}
	popover
	id={dd}
	style="position-anchor:--{dd}"
	class="dropdown dropdown-right dropdown-end border-line rounded-box bg-base-100 ml-2 w-52 border p-2 shadow-lg"
>
	{#if highlights.length > 0}
		<li>
			<button
				type="button"
				onclick={() => {
					panelEl?.togglePopover(false);
					openWhatsNew();
				}}
				class="text-base-content hover:bg-base-200/60 flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors"
			>
				<Sparkles class="text-muted size-4 shrink-0" aria-hidden="true" />
				What's new
			</button>
		</li>
	{/if}
	{#each links as link (link.href)}
		{@const Icon = link.icon}
		<li>
			<a
				href={link.href}
				target="_blank"
				rel="noopener"
				onclick={() => panelEl?.togglePopover(false)}
				class="text-base-content hover:bg-base-200/60 flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors"
			>
				<Icon class="text-muted size-4 shrink-0" aria-hidden="true" />
				{link.label}
			</a>
		</li>
	{/each}
</ul>

<Modal bind:open={whatsNew.open} title="What's new in {version}" onclose={() => triggerEl?.focus()}>
	<ul class="[list-style-type:disc] space-y-2 pl-5 text-sm">
		{#each highlights as highlight}
			<li>{highlight}</li>
		{/each}
	</ul>
	{#snippet actions()}
		<a href={RELEASE_NOTES} target="_blank" rel="noopener" class="btn btn-ghost">
			Full release notes
		</a>
		<button type="button" onclick={() => (whatsNew.open = false)} class="btn btn-primary">
			Got it
		</button>
	{/snippet}
</Modal>
