<script lang="ts">
  import { RefreshCw, Share2, Clock, History as HistoryIcon } from 'lucide-svelte';
  import type { SearchStore } from '$lib/stores/search.svelte';
  import type { DrawerTab } from '$lib/types';

  let {
    store,
    drawerTab = $bindable<DrawerTab | null>(null),
    timeRangeLabel,
  }: {
    store: SearchStore;
    drawerTab?: DrawerTab | null;
    timeRangeLabel: string;
  } = $props();

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

  function toggleHistory() {
    drawerTab = drawerTab === 'history' ? null : 'history';
  }
</script>

<div
  class="flex items-center gap-2 border-b border-base-content/10 bg-base-100 px-3 py-2"
>
  <!-- Index picker -->
  <select
    class="select select-sm select-bordered min-w-[8rem]"
    value={store.selectedIndex}
    onchange={(e) => store.handleIndexChange((e.currentTarget as HTMLSelectElement).value)}
  >
    {#each store.indexes as idx (idx.id)}
      <option value={idx.id}>{idx.name}</option>
    {/each}
  </select>

  <!-- Query input -->
  <input
    type="text"
    class="input input-sm input-bordered min-w-0 flex-1 font-mono"
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

  <!-- Time range (placeholder for now — picker lands later) -->
  <button class="btn btn-sm btn-ghost gap-1" disabled>
    <Clock class="h-3.5 w-3.5" />
    {timeRangeLabel}
  </button>

  <!-- Hit count micro-text -->
  <span class="font-mono text-xs text-base-content/50">
    {store.numHits.toLocaleString()} hits
  </span>

  <div class="ml-auto flex items-center gap-1">
    <button class="btn btn-sm btn-ghost" aria-label="History" onclick={toggleHistory}>
      <HistoryIcon class="h-3.5 w-3.5" />
    </button>
    <button class="btn btn-sm btn-ghost" aria-label="Share" disabled>
      <Share2 class="h-3.5 w-3.5" />
    </button>
    <button class="btn btn-sm btn-ghost" aria-label="Refresh" disabled>
      <RefreshCw class="h-3.5 w-3.5" />
    </button>
  </div>
</div>
