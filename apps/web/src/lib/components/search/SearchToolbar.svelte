<script lang="ts">
  import { Bookmark, BookmarkCheck, Download, Play, Share2 } from 'lucide-svelte';
  import TimeRangePicker from './TimeRangePicker.svelte';
  import type { SearchStore } from '$lib/stores/search.svelte';

  let { store }: { store: SearchStore } = $props();

  // Local edit buffer: separate from store.query so the user can type freely
  // and only commits on blur / Enter. Re-syncs from store when not focused
  // (so URL nav, back/forward, future history-restore land correctly).
  let queryInput = $state(store.query);
  let focused = $state(false);

  $effect(() => {
    if (!focused) queryInput = store.query;
  });

  function commitQuery() {
    if (queryInput !== store.query) {
      store.runQuery(queryInput);
    }
  }
</script>

<div
  class="flex items-center gap-2 border-b border-base-content/10 bg-base-100 px-3 py-2"
>
  <!-- Index picker -->
  <select
    class="select select-sm select-bordered w-auto min-w-0 font-mono text-xs"
    value={store.selectedIndex}
    onchange={(e) => store.handleIndexChange((e.currentTarget as HTMLSelectElement).value)}
  >
    {#each store.indexes as idx (idx.id)}
      <option value={idx.id}>{idx.name}</option>
    {/each}
  </select>

  <!-- Query input with end-of-input Save adornment -->
  <label class="input input-sm input-bordered flex min-w-0 flex-1 items-center gap-1 font-mono">
    <input
      type="text"
      class="grow"
      placeholder="Search logs…"
      bind:value={queryInput}
      onfocus={() => (focused = true)}
      onblur={() => {
        focused = false;
        commitQuery();
      }}
      onkeydown={(e) => {
        if (e.key === 'Enter') commitQuery();
      }}
    />
    <button
      type="button"
      class="btn btn-ghost btn-xs btn-square"
      aria-label="Save query"
      title="Save query"
      disabled
      onmousedown={(e) => e.preventDefault()}
    >
      <Bookmark class="h-3.5 w-3.5" />
    </button>
  </label>

  <!-- Time range -->
  <TimeRangePicker
    value={store.timeRange}
    onChange={(next) => store.navigateQuery({ timeRange: next }, { push: true })}
  />

  <div class="ml-auto flex items-center gap-1">
    <button
      type="button"
      class="btn btn-sm btn-ghost"
      aria-label="Open saved queries"
      title="Open saved queries"
      disabled
    >
      <BookmarkCheck class="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      class="btn btn-sm btn-ghost"
      aria-label="Share"
      title="Share"
      disabled
    >
      <Share2 class="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      class="btn btn-sm btn-ghost"
      aria-label="Export"
      title="Export"
      disabled
    >
      <Download class="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      class="btn btn-sm btn-primary"
      aria-label="Run query"
      title="Run query"
      onclick={() => store.runQuery(queryInput)}
    >
      <Play class="h-3.5 w-3.5" />
      Run
    </button>
  </div>
</div>
