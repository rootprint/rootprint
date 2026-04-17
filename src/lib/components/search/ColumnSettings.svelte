<script lang="ts">
	import { ChevronLeft, GripVertical, Plus, SlidersVertical, X } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import { dndzone } from 'svelte-dnd-action';

	import type { IndexField } from '$lib/types';

	let {
		activeFields = $bindable(),
		allFields,
		pinnedFields = [],
		pinnedFieldsEnd = [],
		onchange
	}: {
		activeFields: string[];
		allFields: IndexField[];
		pinnedFields?: string[];
		pinnedFieldsEnd?: string[];
		onchange?: () => void;
	} = $props();

	let open = $state(false);
	let mode = $state<'columns' | 'add'>('columns');
	let searchTerm = $state('');
	let searchInputEl = $state<HTMLInputElement | null>(null);
	let popoverEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);

	let dndItems = $derived(activeFields.map((name) => ({ id: name, name })));

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

	function addField(name: string) {
		activeFields = [...activeFields, name];
		onchange?.();
	}

	function openAddMode() {
		searchTerm = '';
		mode = 'add';
	}

	$effect(() => {
		if (mode === 'add' && searchInputEl) {
			searchInputEl.focus();
		}
	});

	function toggle() {
		open = !open;
		if (open) {
			mode = 'columns';
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (
			open &&
			popoverEl &&
			!popoverEl.contains(e.target as Node) &&
			triggerEl &&
			!triggerEl.contains(e.target as Node)
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

	const activeSet = $derived(new Set([...activeFields, ...pinnedFields, ...pinnedFieldsEnd]));

	const availableFields = $derived.by(() => {
		let fields = allFields.filter((f) => !activeSet.has(f.name));
		if (searchTerm.trim()) {
			const term = searchTerm.trim().toLowerCase();
			fields = fields.filter((f) => f.name.toLowerCase().includes(term));
		}
		return fields;
	});
</script>

<div class="relative">
	<button bind:this={triggerEl} class="btn btn-sm" onclick={toggle} title="Column settings">
		<SlidersVertical size={14} />
	</button>

	{#if open}
		<div
			bind:this={popoverEl}
			class="absolute top-full right-0 z-50 mt-1 w-64 rounded-lg border border-base-300 bg-base-100 shadow-lg"
		>
			{#if mode === 'add'}
				<div class="border-b border-base-300 px-3 py-2">
					<button
						class="flex items-center gap-1 text-xs font-medium text-base-content/70 hover:text-base-content"
						onclick={() => (mode = 'columns')}
					>
						<ChevronLeft size={14} />
						<span class="tracking-wider uppercase">Add new column</span>
					</button>
				</div>
				<div class="px-3 pt-2">
					<input
						bind:this={searchInputEl}
						type="text"
						class="input input-sm w-full border-base-300"
						placeholder="Search..."
						bind:value={searchTerm}
					/>
				</div>
				<OverlayScrollbarsComponent
					options={{
						scrollbars: { theme: 'os-theme-dark', autoHide: 'leave', autoHideDelay: 400 },
						overflow: { x: 'hidden' }
					}}
					defer
					class="max-h-64"
				>
					<div class="px-1 py-1">
						{#each availableFields as field (field.name)}
							<button
								class="flex w-full items-center rounded px-2 py-1.5 text-xs hover:bg-base-200"
								onclick={() => addField(field.name)}
							>
								{field.name}
							</button>
						{/each}
						{#if availableFields.length === 0}
							<p class="px-2 py-2 text-xs text-base-content/50">
								{searchTerm.trim() ? 'No matching fields' : 'All fields added'}
							</p>
						{/if}
					</div>
				</OverlayScrollbarsComponent>
			{:else}
				<div class="flex items-center border-b border-base-300 px-3 py-2">
					<span class="flex-1 text-xs font-medium tracking-wider text-base-content/70 uppercase">
						Columns
					</span>
					<button class="btn p-0 btn-ghost btn-xs" onclick={openAddMode} title="Add column">
						<Plus size={14} />
					</button>
				</div>
				<OverlayScrollbarsComponent
					options={{
						scrollbars: { theme: 'os-theme-dark', autoHide: 'leave', autoHideDelay: 400 },
						overflow: { x: 'hidden' }
					}}
					defer
					class="max-h-72"
				>
					<div class="flex flex-col px-1 py-1">
						{#each pinnedFields as field (field)}
							<div class="flex items-center gap-1 rounded px-2 py-1.5 text-xs text-base-content/50">
								<span class="w-4 shrink-0"></span>
								<span class="flex-1 truncate">{field}</span>
							</div>
						{/each}

						{#if dndItems.length > 0}
							<div
								use:dndzone={{
									items: dndItems,
									flipDurationMs: 150,
									type: 'column-settings'
								}}
								onconsider={handleDndConsider}
								onfinalize={handleDndFinalize}
								class="flex flex-col"
							>
								{#each dndItems as field (field.id)}
									<div
										class="flex items-center gap-1 rounded px-2 py-1.5 text-xs hover:bg-base-200"
									>
										<GripVertical size={12} class="shrink-0 cursor-grab text-base-content/40" />
										<span class="flex-1 truncate">{field.name}</span>
										<button
											class="btn p-0 btn-ghost btn-xs"
											onclick={() => removeField(field.name)}
										>
											<X size={12} class="text-base-content/40 hover:text-base-content" />
										</button>
									</div>
								{/each}
							</div>
						{/if}

						{#each pinnedFieldsEnd as field (field)}
							<div class="flex items-center gap-1 rounded px-2 py-1.5 text-xs text-base-content/50">
								<span class="w-4 shrink-0"></span>
								<span class="flex-1 truncate">{field}</span>
							</div>
						{/each}
					</div>
				</OverlayScrollbarsComponent>
			{/if}
		</div>
	{/if}
</div>
