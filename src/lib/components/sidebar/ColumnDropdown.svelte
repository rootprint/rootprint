<script lang="ts">
	import { GripVertical, Pin, X } from 'lucide-svelte';
	import { dndzone } from 'svelte-dnd-action';

	let {
		activeFields = $bindable(),
		pinnedFields = [],
		pinnedFieldsEnd = [],
		onchange
	}: {
		activeFields: string[];
		pinnedFields?: string[];
		pinnedFieldsEnd?: string[];
		onchange?: () => void;
	} = $props();

	let open = $state(false);
	let dropdownEl = $state<HTMLDivElement | null>(null);
	let buttonEl = $state<HTMLButtonElement | null>(null);

	let dndItems = $state<{ id: string; name: string }[]>([]);

	$effect(() => {
		dndItems = activeFields.map((name) => ({ id: name, name }));
	});

	function handleDndConsider(e: CustomEvent<{ items: typeof dndItems }>) {
		dndItems = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: typeof dndItems }>) {
		dndItems = e.detail.items;
		activeFields = dndItems.map((f) => f.name);
		onchange?.();
	}

	function removeField(name: string) {
		activeFields = activeFields.filter((f) => f !== name);
		onchange?.();
	}

	function toggle() {
		open = !open;
	}

	function handleClickOutside(e: MouseEvent) {
		if (
			open &&
			dropdownEl &&
			!dropdownEl.contains(e.target as Node) &&
			buttonEl &&
			!buttonEl.contains(e.target as Node)
		) {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside, true);
			return () => document.removeEventListener('click', handleClickOutside, true);
		}
	});

	const totalColumns = $derived(pinnedFields.length + activeFields.length + pinnedFieldsEnd.length);
</script>

<div class="relative">
	<button
		bind:this={buttonEl}
		class="btn btn-ghost btn-xs gap-1 text-[11px]"
		onclick={toggle}
		title="Manage display columns"
	>
		Display
		<span class="rounded bg-base-300 px-1 text-[10px]">{totalColumns}</span>
	</button>

	{#if open}
		<div
			bind:this={dropdownEl}
			class="absolute top-full right-0 z-50 mt-1 w-52 rounded-lg border border-base-300 bg-base-100 p-2 shadow-lg"
		>
			<p class="mb-1 text-[10px] font-medium text-base-content/80 uppercase">
				Display Columns
			</p>
			<div class="flex flex-col gap-0.5">
				{#each pinnedFields as field (field)}
					<div class="flex items-center gap-1 rounded px-1.5 py-1 text-xs">
						<Pin size={10} class="shrink-0 text-base-content/40" />
						<span class="truncate text-base-content/60">{field}</span>
					</div>
				{/each}

				{#if dndItems.length > 0}
					<div
						use:dndzone={{ items: dndItems, flipDurationMs: 150, type: 'column-order' }}
						onconsider={handleDndConsider}
						onfinalize={handleDndFinalize}
						class="flex flex-col gap-0.5"
					>
						{#each dndItems as field (field.id)}
							<div
								class="flex items-center gap-1 rounded bg-base-200 px-1.5 py-1 text-xs"
							>
								<GripVertical
									size={10}
									class="shrink-0 cursor-grab text-base-content/60"
								/>
								<span class="flex-1 truncate">{field.name}</span>
								<button
									class="btn btn-ghost p-0 btn-xs"
									onclick={() => removeField(field.name)}
								>
									<X size={10} class="text-base-content/40" />
								</button>
							</div>
						{/each}
					</div>
				{/if}

				{#each pinnedFieldsEnd as field (field)}
					<div class="flex items-center gap-1 rounded px-1.5 py-1 text-xs">
						<Pin size={10} class="shrink-0 text-base-content/40" />
						<span class="truncate text-base-content/60">{field}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
