<script lang="ts">
  import { CircleX } from 'lucide-svelte';
  import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
  import type { OverlayScrollbars } from 'overlayscrollbars';
  import { OS_SCROLLBAR_BOTH_AXES_OPTIONS } from '$lib/utils/scrollbars';

  import FieldPanel from '$lib/components/sidebar/FieldPanel.svelte';
  import LogDetailDrawer from '$lib/components/log/LogDetailDrawer.svelte';
  import LogFrequencyChart from '$lib/components/log/LogFrequencyChart.svelte';
  import LogHeader from '$lib/components/log/LogHeader.svelte';
  import LogRow from '$lib/components/log/LogRow.svelte';
  import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
  import ColumnSettings from '$lib/components/search/ColumnSettings.svelte';
  import { SearchStore } from '$lib/stores/search.svelte';
  import { buildGridTemplate, computeColumnWidths } from '$lib/utils/column-width';
  import { page } from '$app/state';
  import { deserialize } from '$lib/utils/query-params';
  import type { LogHit } from '$lib/types';

  const SCROLL_TRIGGER_PX = 1500;

  let { data } = $props();
  let osRef = $state<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);

  // Pass a reactive closure so the store always sees the live URL state.
  // page.url is reactive in Svelte 5 — reading it inside a closure tracked
  // by $effect (inside setupAutoSearch) re-runs whenever the URL changes.
  const store = new SearchStore({
    parsedQuery: () => deserialize(page.url.searchParams),
    initialIndexes: data.indexes,
    onFreshSearch: () =>
      osRef?.osInstance()?.elements().viewport.scrollTo(0, 0),
  });

  store.setupAutoSearch();

  let columnWidths = $derived(
    computeColumnWidths(store.rawHits, store.activeFields),
  );
  let gridTemplate = $derived(buildGridTemplate(store.activeFields, columnWidths));

  let chartCollapsed = $state(false);
  let selectedLog = $state<LogHit | null>(null);
  let drawerOpen = $state(false);

  const displayState: 'loading' | 'error' | 'empty' | 'logs' = $derived.by(() => {
    if (store.configError || store.searchError) return 'error';
    if (store.loading === 'fresh' || !store.hasSearched || !store.fieldConfig) return 'loading';
    if (store.logs.length === 0) return 'empty';
    return 'logs';
  });

  function openRow(hit: LogHit) {
    selectedLog = hit;
    drawerOpen = true;
  }

  function handleOsScroll(os: OverlayScrollbars) {
    const v = os.elements().viewport;
    if (v.scrollHeight - v.scrollTop - v.clientHeight < SCROLL_TRIGGER_PX) {
      store.maybeLoadMore();
    }
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

    <div class="relative min-h-0 flex-1">
      <OverlayScrollbarsComponent
        bind:this={osRef}
        options={OS_SCROLLBAR_BOTH_AXES_OPTIONS}
        events={{ scroll: handleOsScroll }}
        defer
        class="h-full w-full bg-base-200/30"
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
              columns={store.activeFields}
              {gridTemplate}
              sortDirection={store.sortDirection}
              ontogglesort={() => store.toggleSort()}
            />
            {#each store.logs as hit (hit.key)}
              <LogRow
                {hit}
                columns={store.activeFields}
                {gridTemplate}
                timezoneMode={store.timezoneMode}
                onclick={() => openRow(hit)}
              />
            {/each}
          </div>
        {/if}
      </OverlayScrollbarsComponent>

      <div
        class="pointer-events-none absolute right-0 top-0 z-20 flex h-[28px] items-center border-b border-base-content/10 bg-base-300 pl-2 pr-1"
      >
        <div class="pointer-events-auto">
          <ColumnSettings
            activeFields={store.activeFields}
            allFields={store.fields}
            pinnedStart={store.fieldConfig
              ? [store.fieldConfig.levelField, store.fieldConfig.timestampField]
              : []}
            pinnedEnd={store.fieldConfig ? [store.fieldConfig.messageField] : []}
            onchange={(next) => store.setActiveFields(next)}
          />
        </div>
      </div>
    </div>

  </div>
</div>

<LogDetailDrawer
  bind:open={drawerOpen}
  hit={selectedLog}
  selectedIndex={store.selectedIndex}
  fieldConfig={store.fieldConfig}
  timezoneMode={store.timezoneMode}
/>
