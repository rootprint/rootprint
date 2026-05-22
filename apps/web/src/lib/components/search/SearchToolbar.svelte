<script lang="ts">
  import { Download, Play, Share2 } from 'lucide-svelte';
  import TimeRangePicker from './TimeRangePicker.svelte';
  import SavedQueriesDropdown from './SavedQueriesDropdown.svelte';
  import type { SearchStore } from '$lib/stores/search.svelte';
  import { toast } from 'svelte-sonner';
  import { copyToClipboard } from '$lib/utils/clipboard';

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

  async function shareLink() {
    const ok = await copyToClipboard(window.location.href);
    if (ok) toast.success('Link copied');
    else toast.error('Failed to copy link');
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

  <!-- Time range -->
  <TimeRangePicker
    value={store.timeRange}
    onChange={(next) => store.navigateQuery({ timeRange: next }, { push: true })}
  />

  <div class="ml-auto flex items-center gap-1">
    <SavedQueriesDropdown {store} />
    <button
      type="button"
      class="btn btn-sm btn-ghost"
      aria-label="Share"
      title="Share"
      onclick={shareLink}
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
