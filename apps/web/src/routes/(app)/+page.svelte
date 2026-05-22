<script lang="ts">
  import { CircleX } from 'lucide-svelte';
  import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
  import { OS_SCROLLBAR_BOTH_AXES_OPTIONS } from '$lib/utils/scrollbars';

  import FieldPanel from '$lib/components/sidebar/FieldPanel.svelte';
  import LogDetailDrawer from '$lib/components/log/LogDetailDrawer.svelte';
  import LogFrequencyChart from '$lib/components/log/LogFrequencyChart.svelte';
  import LogHeader from '$lib/components/log/LogHeader.svelte';
  import LogRow from '$lib/components/log/LogRow.svelte';
  import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
  import { SearchStore } from '$lib/stores/search.svelte';
  import { page } from '$app/state';
  import { deserialize } from '$lib/utils/query-params';
  import type { LogHit } from '$lib/types';

  let { data } = $props();

  // Pass a reactive closure so the store always sees the live URL state.
  // page.url is reactive in Svelte 5 — reading it inside a closure tracked
  // by $effect (inside setupAutoSearch) re-runs whenever the URL changes.
  const store = new SearchStore({
    parsedQuery: () => deserialize(page.url.searchParams),
    initialIndexes: data.indexes,
  });

  store.setupAutoSearch();

  // View-only state (would be store-owned in the next iteration)
  let chartCollapsed = $state(false);
  let selectedLog = $state<LogHit | null>(null);
  let drawerOpen = $state(false);

  const displayState: 'loading' | 'error' | 'empty' | 'logs' = $derived(
    store.configError || store.searchError
      ? 'error'
      : store.loading === 'fresh' || !store.hasSearched || !store.fieldConfig
        ? 'loading'
        : store.logs.length === 0
          ? 'empty'
          : 'logs'
  );

  function openRow(hit: LogHit) {
    selectedLog = hit;
    drawerOpen = true;
  }


</script>

<div class="flex h-full w-full min-h-0">
  <!-- Left: FieldPanel -->
  <aside
    class="w-56 shrink-0 border-r border-base-content/10"
  >
    <FieldPanel {store} />
  </aside>

  <!-- Right: main column -->
  <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <SearchToolbar {store} />

    <LogFrequencyChart
      buckets={store.histogramBuckets}
      loading={store.histogramLoading}
      error={store.histogramError}
      numHits={store.numHits}
      timezoneMode={store.timezoneMode}
      bind:collapsed={chartCollapsed}
      onbrush={(start, end) =>
        store.navigateQuery(
          { timeRange: { type: 'absolute', start, end } },
          { push: true }
        )}
    />

    <OverlayScrollbarsComponent
      options={OS_SCROLLBAR_BOTH_AXES_OPTIONS}
      defer
      class="min-h-0 flex-1 bg-base-200/30"
    >
      {#if displayState === 'loading'}
        <div class="flex h-full items-center justify-center">
          <div class="flex items-center gap-2 font-mono text-xs text-base-content/60">
            <span class="loading loading-spinner loading-sm"></span>
            Loading…
          </div>
        </div>
      {:else if displayState === 'error'}
        <div class="flex h-full items-center justify-center">
          <div class="alert alert-error max-w-md">
            <CircleX class="h-4 w-4 shrink-0" />
            <span class="font-mono text-xs">{store.configError ?? store.searchError ?? 'Something went wrong.'}</span>
            <button class="btn btn-ghost btn-sm" disabled>Retry</button>
          </div>
        </div>
      {:else if displayState === 'empty'}
        <div class="flex h-full flex-col items-center justify-center gap-1">
          <p class="font-mono text-xs text-base-content/60">No logs found</p>
          <p class="font-mono text-[10px] text-base-content/40">
            Try adjusting your time range or query filters
          </p>
        </div>
      {:else}
        <div class="w-fit min-w-full">
          <LogHeader
            fieldConfig={store.fieldConfig}
            sortDirection={store.sortDirection}
            ontogglesort={() => store.toggleSort()}
          />
          {#each store.logs as hit (hit.key)}
            <LogRow
              {hit}
              timezoneMode={store.timezoneMode}
              onclick={() => openRow(hit)}
            />
          {/each}
        </div>
      {/if}
    </OverlayScrollbarsComponent>

  </div>
</div>

<LogDetailDrawer
  bind:open={drawerOpen}
  hit={selectedLog}
  selectedIndex={store.selectedIndex}
  fieldConfig={store.fieldConfig}
  timezoneMode={store.timezoneMode}
/>
