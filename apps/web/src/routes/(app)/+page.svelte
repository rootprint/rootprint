<script lang="ts">
  import { CircleX } from 'lucide-svelte';

  import FieldPanel from '$lib/components/sidebar/FieldPanel.svelte';
  import HistoryDrawer from '$lib/components/search/HistoryDrawer.svelte';
  import LogDetailDrawer from '$lib/components/log/LogDetailDrawer.svelte';
  import LogFrequencyChart from '$lib/components/log/LogFrequencyChart.svelte';
  import LogHeader from '$lib/components/log/LogHeader.svelte';
  import LogRow from '$lib/components/log/LogRow.svelte';
  import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
  import type { DrawerTab, LogHit, SortDirection, WrapMode } from '$lib/types';

  let { data } = $props();

  // View-only state (would be store-owned in the next iteration)
  let wrapMode = $state<WrapMode>(data.wrapMode);
  let drawerTab = $state<DrawerTab | null>(null);
  let chartCollapsed = $state(false);
  let sortDirection = $state<SortDirection>('desc');
  let selectedLog = $state<LogHit | null>(null);
  let drawerOpen = $state(false);

  function openRow(hit: LogHit) {
    selectedLog = hit;
    drawerOpen = true;
  }

  function toggleSort() {
    sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
  }
</script>

<div class="flex h-full w-full min-h-0">
  <!-- Left: FieldPanel -->
  <aside
    class="w-56 shrink-0 border-r border-base-content/10"
  >
    <FieldPanel
      levels={data.levels}
      fields={data.fields}
      isOtelIndex={data.isOtelIndex}
      fieldValues={data.fieldValues}
    />
  </aside>

  <!-- Right: main column -->
  <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <SearchToolbar
      indexes={data.indexes}
      selectedIndex={data.selectedIndex}
      query={data.query}
      timeRangeLabel={data.timeRangeLabel}
      numHits={data.numHits}
      bind:wrapMode
      bind:drawerTab
    />

    <LogFrequencyChart
      data={data.histogram}
      timezoneMode={data.timezoneMode}
      numHits={data.numHits}
      bind:collapsed={chartCollapsed}
    />

    <div class="min-h-0 flex-1 overflow-auto bg-base-200/30">
      {#if data.state === 'loading'}
        <div class="flex h-full items-center justify-center">
          <div class="flex items-center gap-2 font-mono text-xs text-base-content/60">
            <span class="loading loading-spinner loading-sm"></span>
            Loading…
          </div>
        </div>
      {:else if data.state === 'error'}
        <div class="flex h-full items-center justify-center">
          <div class="alert alert-error max-w-md">
            <CircleX class="h-4 w-4 shrink-0" />
            <span class="font-mono text-xs">Something went wrong.</span>
            <button class="btn btn-ghost btn-sm" disabled>Retry</button>
          </div>
        </div>
      {:else if data.state === 'empty' || data.logs.length === 0}
        <div class="flex h-full flex-col items-center justify-center gap-1">
          <p class="font-mono text-xs text-base-content/60">No logs found</p>
          <p class="font-mono text-[10px] text-base-content/40">
            Try adjusting your time range or query filters
          </p>
        </div>
      {:else}
        <div class="w-fit min-w-full">
          {#if wrapMode === 'none'}
            <LogHeader {sortDirection} ontogglesort={toggleSort} />
          {/if}
          {#each data.logs as hit (hit.key)}
            <LogRow
              {hit}
              {wrapMode}
              timezoneMode={data.timezoneMode}
              onclick={() => openRow(hit)}
            />
          {/each}
        </div>
      {/if}
    </div>

    <HistoryDrawer
      bind:drawerTab
      history={data.history}
      savedQueries={data.savedQueries}
      sharedQueries={data.sharedQueries}
    />
  </div>
</div>

<LogDetailDrawer
  bind:open={drawerOpen}
  hit={selectedLog}
  selectedIndex={data.selectedIndex}
  fieldConfig={data.fieldConfig}
  timezoneMode={data.timezoneMode}
/>
