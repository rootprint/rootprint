<script lang="ts">
  import { RefreshCw, Share2, TextWrap, Clock, History as HistoryIcon } from 'lucide-svelte';
  import type { DrawerTab, IndexOption, WrapMode } from '$lib/types';

  let {
    indexes,
    selectedIndex,
    query,
    timeRangeLabel,
    numHits,
    wrapMode = $bindable<WrapMode>('none'),
    drawerTab = $bindable<DrawerTab | null>(null),
    onQueryChange = () => {},
    onIndexChange = () => {},
    onTimeRangeOpen = () => {},
    onShare = () => {},
    onRefresh = () => {}
  }: {
    indexes: IndexOption[];
    selectedIndex: string;
    query: string;
    timeRangeLabel: string;
    numHits: number;
    wrapMode?: WrapMode;
    drawerTab?: DrawerTab | null;
    onQueryChange?: (value: string) => void;
    onIndexChange?: (id: string) => void;
    onTimeRangeOpen?: () => void;
    onShare?: () => void;
    onRefresh?: () => void;
  } = $props();

  // TODO(store): re-sync queryInput when query prop changes (e.g. URL nav, history restore)
  let queryInput = $state(query);

  function commitQuery() {
    if (queryInput !== query) {
      onQueryChange(queryInput); // TODO(store): wire to search store
    }
  }

  function nextWrapMode(m: WrapMode): WrapMode {
    return m === 'none' ? 'truncate' : m === 'truncate' ? 'wrap' : 'none';
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
    value={selectedIndex}
    onchange={(e) => onIndexChange((e.currentTarget as HTMLSelectElement).value)}
  >
    {#each indexes as idx (idx.id)}
      <option value={idx.id}>{idx.name}</option>
    {/each}
  </select>

  <!-- Query input -->
  <input
    type="text"
    class="input input-sm input-bordered min-w-0 flex-1 font-mono"
    placeholder="Search logs…"
    bind:value={queryInput}
    onblur={commitQuery}
    onkeydown={(e) => {
      if (e.key === 'Enter') commitQuery();
    }}
  />

  <!-- Time range -->
  <button class="btn btn-sm btn-ghost gap-1" onclick={onTimeRangeOpen}>
    <Clock class="h-3.5 w-3.5" />
    {timeRangeLabel}
  </button>

  <!-- Hit count micro-text -->
  <span class="font-mono text-xs text-base-content/50">
    {numHits.toLocaleString()} hits
  </span>

  <div class="ml-auto flex items-center gap-1">
    <button
      class="btn btn-sm btn-ghost"
      aria-label="Toggle wrap mode"
      onclick={() => (wrapMode = nextWrapMode(wrapMode))}
    >
      <TextWrap class="h-3.5 w-3.5" />
    </button>
    <button class="btn btn-sm btn-ghost" aria-label="History" onclick={toggleHistory}>
      <HistoryIcon class="h-3.5 w-3.5" />
    </button>
    <button class="btn btn-sm btn-ghost" aria-label="Share" onclick={onShare}>
      <Share2 class="h-3.5 w-3.5" />
    </button>
    <button class="btn btn-sm btn-ghost" aria-label="Refresh" onclick={onRefresh}>
      <RefreshCw class="h-3.5 w-3.5" />
    </button>
  </div>
</div>
