<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	type Tab = {
		id: string;
		label: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- lucide-svelte uses Svelte 4 class components
		icon: any;
		disabled?: boolean;
	};

	let {
		open = $bindable(false),
		tabs,
		activeTab = $bindable(undefined),
		panelClass = 'w-full md:w-[50vw]',
		actions,
		children
	}: {
		open: boolean;
		tabs?: Tab[];
		activeTab?: string;
		panelClass?: string;
		actions?: Snippet;
		children: Snippet;
	} = $props();

	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') close();
	}

	// If activeTab references a removed/disabled tab, fall back to first enabled tab
	$effect(() => {
		if (!tabs || !activeTab) return;
		const valid = tabs.find((t) => t.id === activeTab && !t.disabled);
		if (!valid) {
			const first = tabs.find((t) => !t.disabled);
			if (first) activeTab = first.id;
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-10 bg-black/50"
		role="button"
		tabindex="-1"
		aria-label="close drawer"
		onclick={close}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') close();
		}}
	></div>

	<div
		transition:fly={{ x: 400, duration: 200 }}
		class="fixed top-0 right-0 z-20 flex h-full flex-col border-l border-base-300 bg-base-100 shadow-lg {panelClass}"
	>
		<div class="flex items-center justify-between border-b border-base-300 px-3">
			{#if tabs}
				<div role="tablist" class="tabs-border tabs">
					{#each tabs as tab (tab.id)}
						{@const TabIcon = tab.icon}
						<button
							role="tab"
							class="tab gap-1.5"
							class:tab-active={activeTab === tab.id}
							disabled={tab.disabled}
							title={tab.disabled ? `${tab.label} (coming soon)` : tab.label}
							onclick={() => {
								if (!tab.disabled) activeTab = tab.id;
							}}
						>
							<TabIcon size={14} />
							{tab.label}
						</button>
					{/each}
				</div>
			{:else}
				<div></div>
			{/if}
			<div class="flex items-center gap-1">
				{#if actions}
					{@render actions()}
				{/if}
				<button class="btn btn-square btn-ghost btn-xs" onclick={close} title="Close">
					<X size={14} />
				</button>
			</div>
		</div>

		{@render children()}
	</div>
{/if}
