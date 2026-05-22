<script lang="ts">
  import { BookmarkCheck, Bookmark, Search, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-svelte';
  import {
    listSavedQueries,
    createSavedQuery,
    updateSavedQuery,
    deleteSavedQuery,
    SavedQueryError,
  } from '$lib/api/saved-queries';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import type { SearchStore } from '$lib/stores/search.svelte';
  import type { SavedQuery } from 'api/types';

  let { store }: { store: SearchStore } = $props();

  let items = $state<SavedQuery[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let details = $state<HTMLDetailsElement | null>(null);
  let filterText = $state('');
  let toDelete = $state<SavedQuery | null>(null);
  let deleteModalOpen = $state(false);
  let deleting = $state(false);

  type View = 'list' | 'form';

  let view = $state<View>('list');
  let editing = $state<SavedQuery | null>(null);
  let formName = $state('');
  let formDescription = $state('');
  let formQuery = $state('');
  let formError = $state<string | null>(null);
  let formNameError = $state<string | null>(null);
  let formSubmitting = $state(false);

  async function refresh() {
    const indexId = store.selectedIndex;
    if (indexId === null) {
      items = [];
      error = 'No index selected';
      return;
    }
    loading = true;
    error = null;
    try {
      items = await listSavedQueries(indexId);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load saved queries';
      items = [];
    } finally {
      loading = false;
    }
  }

  function openNewForm(prefillName = '') {
    editing = null;
    formName = prefillName;
    formDescription = '';
    formQuery = store.query;
    formError = null;
    formNameError = null;
    view = 'form';
  }

  function openEditForm(item: SavedQuery) {
    editing = item;
    formName = item.name;
    formDescription = item.description ?? '';
    formQuery = item.query;
    formError = null;
    formNameError = null;
    view = 'form';
  }

  function backToList() {
    view = 'list';
    editing = null;
    formError = null;
    formNameError = null;
  }

  const formCanSave = $derived.by(() => {
    if (formSubmitting) return false;
    if (formName.trim().length === 0) return false;
    if (!editing) return true;
    const nameChanged = formName !== editing.name;
    const descChanged = formDescription !== (editing.description ?? '');
    const queryChanged = formQuery !== editing.query;
    return nameChanged || descChanged || queryChanged;
  });

  async function submitForm() {
    if (!formCanSave) return;
    const indexId = store.selectedIndex;
    if (indexId === null) {
      formError = 'No index selected';
      return;
    }
    formSubmitting = true;
    formError = null;
    formNameError = null;
    try {
      if (editing) {
        const patch: { name?: string; description?: string | null; query?: string } = {};
        if (formName !== editing.name) patch.name = formName;
        if (formDescription !== (editing.description ?? '')) {
          patch.description = formDescription === '' ? null : formDescription;
        }
        if (formQuery !== editing.query) patch.query = formQuery;
        const row = await updateSavedQuery(indexId, editing.id, patch);
        items = items.map((it) => (it.id === row.id ? row : it));
      } else {
        const row = await createSavedQuery(indexId, {
          name: formName,
          description: formDescription === '' ? undefined : formDescription,
          query: formQuery,
        });
        items = [row, ...items];
      }
      backToList();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save query';
      const code = e instanceof SavedQueryError ? e.code : undefined;
      if (code === 'SAVED_QUERY_NAME_TAKEN') {
        formNameError = message;
      } else {
        formError = message;
      }
    } finally {
      formSubmitting = false;
    }
  }

  function openDeleteModal(item: SavedQuery) {
    toDelete = item;
    deleteModalOpen = true;
  }

  async function confirmDelete() {
    const item = toDelete;
    if (!item) return;
    const indexId = store.selectedIndex;
    if (indexId === null) {
      error = 'No index selected';
      deleteModalOpen = false;
      return;
    }
    deleting = true;
    try {
      await deleteSavedQuery(indexId, item.id);
      items = items.filter((it) => it.id !== item.id);
      deleteModalOpen = false;
      toDelete = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete saved query';
      deleteModalOpen = false;
    } finally {
      deleting = false;
    }
  }

  function close() {
    if (details) details.open = false;
  }

  function onToggle() {
    if (details?.open) {
      refresh();
    } else {
      filterText = '';
      view = 'list';
      editing = null;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && details?.open) close();
  }

  function onWindowClick(e: MouseEvent) {
    if (!details?.open) return;
    // `composedPath()` captures the event path at dispatch time, so it still
    // resolves correctly when the click originated on an element that Svelte
    // re-rendered out of the DOM (e.g. the footer button flipping `view` to
    // `'form'` removes the button before the window listener runs).
    if (details && e.composedPath().includes(details)) return;
    close();
  }

  const filtered = $derived.by(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = item.name.toLowerCase();
      const desc = (item.description ?? '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  });

  function applyItem(query: string) {
    store.runQuery(query);
    close();
  }
</script>

<svelte:window onkeydown={onKeydown} onclick={onWindowClick} />

<details bind:this={details} ontoggle={onToggle} class="dropdown dropdown-end">
  <summary
    aria-label="Saved queries"
    title="Saved queries"
    class="btn btn-sm btn-ghost list-none"
  >
    <BookmarkCheck class="h-3.5 w-3.5" />
  </summary>

  <div
    class="dropdown-content hairline rounded-box z-50 mt-1 flex w-80 flex-col bg-base-100"
  >
    {#if view === 'list'}
      <div class="border-b border-base-content/10 px-3 pt-3 pb-2">
        <p class="eyebrow">Saved queries</p>
      </div>

      <div class="border-b border-base-content/10 px-3 py-2">
        <label class="input input-sm input-bordered flex items-center gap-2 font-mono">
          <Search class="h-3.5 w-3.5 opacity-60" />
          <input
            type="text"
            class="grow"
            placeholder="Search saved queries…"
            bind:value={filterText}
          />
        </label>
      </div>

      <div class="max-h-72 min-h-[6rem] flex-1 overflow-y-auto">
        {#if loading && items.length === 0}
          <div class="flex h-24 items-center justify-center gap-2 font-mono text-xs text-base-content/60">
            <span class="loading loading-spinner loading-xs"></span>
            Loading…
          </div>
        {:else if error}
          <div class="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
            <p class="font-mono text-xs text-error">{error}</p>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => refresh()}
            >
              Retry
            </button>
          </div>
        {:else if items.length === 0}
          <div class="flex h-full items-center justify-center p-3">
            <p class="font-mono text-xs text-base-content/60">No saved queries yet</p>
          </div>
        {:else if filtered.length === 0}
          <div class="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
            <p class="font-mono text-xs text-base-content/60">No matches.</p>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => openNewForm(filterText)}
            >
              <Plus class="h-3.5 w-3.5" />
              Save as "{filterText}"
            </button>
          </div>
        {:else}
          <ul class="py-1">
            {#each filtered as item (item.id)}
              <li>
                <div class="group flex items-center hover:bg-base-200">
                  <button
                    type="button"
                    class="flex flex-1 items-center gap-2 px-3 py-1.5 text-left"
                    onclick={() => applyItem(item.query)}
                    title={item.query}
                  >
                    <Bookmark class="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span class="truncate font-mono text-xs">{item.name}</span>
                  </button>
                  <div class="flex shrink-0 items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs btn-square"
                      aria-label="Edit"
                      title="Edit"
                      onclick={() => openEditForm(item)}
                    >
                      <Pencil class="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs btn-square text-error"
                      aria-label="Delete"
                      title="Delete"
                      onclick={() => openDeleteModal(item)}
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="border-t border-base-content/10 px-3 py-2">
        <button
          type="button"
          class="btn btn-ghost btn-xs w-full justify-start font-mono"
          onclick={() => openNewForm()}
        >
          <Plus class="h-3.5 w-3.5" />
          New saved query
        </button>
      </div>
    {:else}
      <div class="flex items-center gap-2 border-b border-base-content/10 px-3 pt-3 pb-2">
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square"
          aria-label="Back to list"
          onclick={backToList}
        >
          <ArrowLeft class="h-3.5 w-3.5" />
        </button>
        <p class="eyebrow truncate">
          {editing ? `Edit "${editing.name}"` : 'New saved query'}
        </p>
      </div>

      <div class="flex flex-col gap-3 p-3">
        <div class="flex flex-col gap-1">
          <p class="eyebrow">Name</p>
          <input
            type="text"
            class="input input-sm input-bordered font-mono"
            placeholder="My saved query"
            bind:value={formName}
            onkeydown={(e) => {
              if (e.key === 'Enter') submitForm();
            }}
          />
          {#if formNameError}
            <p class="font-mono text-xs text-error">{formNameError}</p>
          {/if}
        </div>

        <div class="flex flex-col gap-1">
          <p class="eyebrow">Description (optional)</p>
          <input
            type="text"
            class="input input-sm input-bordered font-mono"
            placeholder="What does this query find?"
            bind:value={formDescription}
          />
        </div>

        <div class="flex flex-col gap-1">
          <p class="eyebrow">Query</p>
          <textarea
            class="textarea textarea-sm textarea-bordered font-mono"
            rows="3"
            bind:value={formQuery}
          ></textarea>
        </div>

        {#if formError}
          <p class="font-mono text-xs text-error">{formError}</p>
        {/if}
      </div>

      <div class="flex justify-end gap-2 border-t border-base-content/10 px-3 py-2">
        <button type="button" class="btn btn-ghost btn-sm" onclick={backToList}>Cancel</button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          disabled={!formCanSave}
          onclick={submitForm}
        >
          {editing ? 'Save' : 'Save query'}
        </button>
      </div>
    {/if}
  </div>
</details>

<ConfirmModal
  bind:open={deleteModalOpen}
  title="Delete saved query"
  confirmLabel="Delete"
  confirmingLabel="Deleting…"
  bind:loading={deleting}
  onConfirm={confirmDelete}
>
  {#snippet message()}
    Delete <span class="font-mono font-semibold">{toDelete?.name}</span>? This can't be undone.
  {/snippet}
</ConfirmModal>
