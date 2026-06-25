<script lang="ts">
	import { ChevronLeft, GripVertical, Plus, Settings, X } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import { dndzone } from 'svelte-dnd-action';

	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';
	import type { LogField } from '$lib/types';
	import type { DisplayMode } from 'api/types';

	let {
		activeFields,
		allFields,
		pinnedStart = [],
		messageField,
		lineWrap,
		displayMode,
		onColumnsChange,
		onLineWrapChange,
		onDisplayModeChange
	}: {
		activeFields: string[];
		allFields: LogField[];
		pinnedStart?: string[];
		messageField?: string;
		lineWrap: boolean;
		displayMode: DisplayMode;
		onColumnsChange: (next: string[]) => void;
		onLineWrapChange: (next: boolean) => void;
		onDisplayModeChange: (next: DisplayMode) => void;
	} = $props();

	let open = $state(false);
	let mode = $state<'columns' | 'add'>('columns');
	let searchTerm = $state('');

	let triggerEl = $state<HTMLButtonElement | null>(null);
	let popoverEl = $state<HTMLDivElement | null>(null);
	let searchInputEl = $state<HTMLInputElement | null>(null);

	type DndItem = { id: string; name: string; label: string };

	// svelte-dnd-action mutates the list during drag, so this must be writable
	// $state, not $derived. We re-sync from `activeFields` via $effect.
	let dndItems = $state<DndItem[]>([]);

	const pinnedSet = $derived(new Set<string>(pinnedStart));

	$effect(() => {
		dndItems = activeFields
			.filter((name) => !pinnedSet.has(name))
			.map((name) => ({
				id: name,
				name,
				label: name
			}));
	});

	function handleDndConsider(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
		onColumnsChange(dndItems.map((f) => f.name));
	}

	// Source updates from dndItems so legacy pinned entries in activeFields
	// get dropped on the next save instead of being preserved indefinitely.
	function removeField(name: string) {
		onColumnsChange(dndItems.map((f) => f.name).filter((f) => f !== name));
	}

	function addField(name: string) {
		const names = dndItems.map((f) => f.name);
		const messageIndex = messageField ? names.indexOf(messageField) : -1;
		onColumnsChange(
			messageIndex === -1
				? [...names, name]
				: [...names.slice(0, messageIndex), name, ...names.slice(messageIndex)]
		);
		mode = 'columns';
		searchTerm = '';
	}

	function openAddMode() {
		searchTerm = '';
		mode = 'add';
	}

	function toggle() {
		open = !open;
		if (open) mode = 'columns';
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

	$effect(() => {
		if (mode === 'add' && searchInputEl) {
			searchInputEl.focus();
		}
	});

	const activeSet = $derived(new Set<string>([...activeFields, ...pinnedStart]));

	const availableFields = $derived.by(() => {
		let fields = allFields.filter((f) => !activeSet.has(f.name));
		const term = searchTerm.trim().toLowerCase();
		if (term) {
			fields = fields.filter(
				(f) => f.name.toLowerCase().includes(term) || f.displayName.toLowerCase().includes(term)
			);
		}
		return fields;
	});
</script>

<div class="relative">
	<button
		bind:this={triggerEl}
		type="button"
		class="btn btn-xs btn-square btn-ghost"
		aria-label="Display settings"
		title="Display settings"
		onclick={toggle}
	>
		<Settings class="h-4 w-4" />
	</button>

	{#if open}
		<div
			bind:this={popoverEl}
			class="border-line bg-base-100 absolute top-full right-0 z-50 mt-1 w-64 rounded-lg border tracking-normal normal-case shadow-lg"
		>
			{#if mode === 'add'}
				<div class="border-line border-b px-3 py-2">
					<button
						type="button"
						class="text-base-content/60 hover:text-base-content flex items-center gap-1 text-xs font-medium tracking-wider uppercase"
						onclick={() => (mode = 'columns')}
					>
						<ChevronLeft class="h-3.5 w-3.5" />
						<span>Add column</span>
					</button>
				</div>
				<div class="px-3 pt-2">
					<input
						bind:this={searchInputEl}
						type="text"
						class="input input-sm w-full font-mono text-xs"
						placeholder="Search fields…"
						bind:value={searchTerm}
					/>
				</div>
				<OverlayScrollbarsComponent options={OS_SCROLLBAR_OPTIONS} defer class="max-h-64">
					<div class="px-1 py-1">
						{#each availableFields as field (field.name)}
							<button
								type="button"
								class="hover:bg-base-200 text-base-content flex w-full items-center rounded px-2 py-1.5 text-left font-mono text-xs"
								onclick={() => addField(field.name)}
								title={field.name}
							>
								{field.name}
							</button>
						{/each}
						{#if availableFields.length === 0}
							<p class="text-base-content/50 px-2 py-2 text-xs">
								{searchTerm.trim() ? 'No matching fields' : 'All fields added'}
							</p>
						{/if}
					</div>
				</OverlayScrollbarsComponent>
			{:else}
				<div class="border-line border-b px-3 py-2">
					<div class="text-base-content/60 mb-1.5 text-[10px] font-medium tracking-wider uppercase">
						Display
					</div>
					<label class="flex cursor-pointer items-center justify-between">
						<span class="text-base-content text-xs">Line wrap</span>
						<input
							type="checkbox"
							class="toggle toggle-sm"
							checked={lineWrap}
							onchange={(e) => onLineWrapChange(e.currentTarget.checked)}
						/>
					</label>
				</div>

				<div class="border-line border-b px-3 py-2">
					<div class="text-base-content/60 mb-1.5 text-[10px] font-medium tracking-wider uppercase">
						Mode
					</div>
					<div class="join w-full">
						<button
							type="button"
							class="btn join-item btn-xs flex-1 {displayMode === 'table' ? 'btn-primary' : ''}"
							onclick={() => onDisplayModeChange('table')}
						>
							Table
						</button>
						<button
							type="button"
							class="btn join-item btn-xs flex-1 {displayMode === 'inline' ? 'btn-primary' : ''}"
							onclick={() => onDisplayModeChange('inline')}
						>
							Inline
						</button>
					</div>
				</div>

				<div
					class="text-base-content/60 px-3 pt-2 text-[10px] font-medium tracking-wider uppercase"
				>
					Columns
				</div>

				{#snippet pinnedRow(field: string)}
					<div
						class="text-base-content/40 flex items-center gap-1 rounded px-2 py-1.5 font-mono text-xs"
					>
						<span class="w-3 shrink-0"></span>
						<span class="flex-1 truncate">{field}</span>
					</div>
				{/snippet}

				<div class="flex flex-col px-1 py-1">
					{#each pinnedStart as field (field)}
						{@render pinnedRow(field)}
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
									class="hover:bg-base-200 text-base-content flex items-center gap-1 rounded px-2 py-1.5 font-mono text-xs"
								>
									<GripVertical class="text-base-content/40 h-3 w-3 shrink-0 cursor-grab" />
									<span class="flex-1 truncate" title={field.name}>{field.label}</span>
									<button
										type="button"
										class="btn btn-ghost btn-xs p-0"
										aria-label="Remove column"
										onclick={() => removeField(field.name)}
									>
										<X class="text-base-content/40 hover:text-base-content h-3 w-3" />
									</button>
								</div>
							{/each}
						</div>
					{/if}

					<button
						type="button"
						class="text-base-content/70 hover:bg-base-200 hover:text-base-content mt-1 flex items-center gap-1 rounded px-2 py-1.5 text-left text-xs"
						onclick={openAddMode}
					>
						<Plus class="h-3 w-3 shrink-0" />
						<span>Add column</span>
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
