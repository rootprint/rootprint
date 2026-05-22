<script lang="ts">
  import { ChevronLeft, GripVertical, Plus, Settings, X } from 'lucide-svelte';
  import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
  import { dndzone } from 'svelte-dnd-action';

  import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';
  import type { LogField } from '$lib/types';

  let {
    activeFields,
    allFields,
    pinnedStart = [],
    pinnedEnd = [],
    onchange,
  }: {
    activeFields: string[];
    allFields: LogField[];
    pinnedStart?: string[];
    pinnedEnd?: string[];
    onchange: (next: string[]) => void;
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

  $effect(() => {
    dndItems = activeFields.map((name) => {
      const field = allFields.find((f) => f.name === name);
      return { id: name, name, label: field?.displayName ?? name };
    });
  });

  function handleDndConsider(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
    onchange(dndItems.map((f) => f.name));
  }

  function removeField(name: string) {
    onchange(activeFields.filter((f) => f !== name));
  }

  function addField(name: string) {
    onchange([...activeFields, name]);
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

  // Fields available to be added: not already active, not pinned.
  const activeSet = $derived(
    new Set<string>([...activeFields, ...pinnedStart, ...pinnedEnd])
  );

  const availableFields = $derived.by(() => {
    let fields = allFields.filter((f) => !activeSet.has(f.name));
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      fields = fields.filter(
        (f) =>
          f.name.toLowerCase().includes(term) ||
          f.displayName.toLowerCase().includes(term)
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
    aria-label="Column settings"
    title="Column settings"
    onclick={toggle}
  >
    <Settings class="h-3 w-3" />
  </button>

  {#if open}
    <div
      bind:this={popoverEl}
      class="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-base-content/10 bg-base-100 shadow-lg"
    >
      {#if mode === 'add'}
        <div class="border-b border-base-content/10 px-3 py-2">
          <button
            type="button"
            class="flex items-center gap-1 text-xs font-medium tracking-wider uppercase text-base-content/60 hover:text-base-content"
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
            class="input input-sm input-bordered w-full font-mono text-xs"
            placeholder="Search fields…"
            bind:value={searchTerm}
          />
        </div>
        <OverlayScrollbarsComponent
          options={OS_SCROLLBAR_OPTIONS}
          defer
          class="max-h-64"
        >
          <div class="px-1 py-1">
            {#each availableFields as field (field.name)}
              <button
                type="button"
                class="flex w-full items-center rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-base-200"
                onclick={() => addField(field.name)}
                title={field.name}
              >
                {field.displayName}
              </button>
            {/each}
            {#if availableFields.length === 0}
              <p class="px-2 py-2 font-mono text-xs text-base-content/50">
                {searchTerm.trim() ? 'No matching fields' : 'All fields added'}
              </p>
            {/if}
          </div>
        </OverlayScrollbarsComponent>
      {:else}
        {#snippet pinnedRow(field: string)}
          <div class="flex items-center gap-1 rounded px-2 py-1.5 font-mono text-xs text-base-content/40">
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
                type: 'column-settings',
              }}
              onconsider={handleDndConsider}
              onfinalize={handleDndFinalize}
              class="flex flex-col"
            >
              {#each dndItems as field (field.id)}
                <div class="flex items-center gap-1 rounded px-2 py-1.5 font-mono text-xs hover:bg-base-200">
                  <GripVertical class="h-3 w-3 shrink-0 cursor-grab text-base-content/40" />
                  <span class="flex-1 truncate" title={field.name}>{field.label}</span>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs p-0"
                    aria-label="Remove column"
                    onclick={() => removeField(field.name)}
                  >
                    <X class="h-3 w-3 text-base-content/40 hover:text-base-content" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}

          <button
            type="button"
            class="mt-1 flex items-center gap-1 rounded px-2 py-1.5 text-left font-mono text-xs text-base-content/70 hover:bg-base-200 hover:text-base-content"
            onclick={openAddMode}
          >
            <Plus class="h-3 w-3 shrink-0" />
            <span>Add column</span>
          </button>

          {#each pinnedEnd as field (field)}
            {@render pinnedRow(field)}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
