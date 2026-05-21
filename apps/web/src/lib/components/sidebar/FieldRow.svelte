<script lang="ts">
  import { ChevronDown, ChevronRight } from 'lucide-svelte';
  import type { FetchFieldValuesFn, LogField, LogFieldValueBucket } from '$lib/types';
  import type { SearchStore } from '$lib/stores/search.svelte';
  import { FIELD_VALUES_INITIAL_SHOW, FIELD_VALUES_LIMIT } from '$lib/api/field-values';
  import { serializeTimeRange } from '$lib/utils/fields';

  let {
    field,
    store,
    fetchValues,
    indented = false
  }: {
    field: LogField;
    store: SearchStore;
    fetchValues: FetchFieldValuesFn;
    indented?: boolean;
  } = $props();

  let open = $state(false);
  let valueSearch = $state('');
  let showCount = $state(FIELD_VALUES_INITIAL_SHOW);

  let values = $state<LogFieldValueBucket[]>([]);
  let valuesLoading = $state(false);
  let valuesError = $state<string | null>(null);
  let loadedKey: string | null = null;
  let abortCtl: AbortController | null = null;

  let normalizedValueSearch = $derived(valueSearch.trim().toLowerCase());

  let filteredValues = $derived(
    normalizedValueSearch
      ? values.filter((b) => b.value.toLowerCase().includes(normalizedValueSearch))
      : values
  );

  let visibleValues = $derived(
    normalizedValueSearch ? filteredValues : filteredValues.slice(0, showCount)
  );

  let remaining = $derived(
    normalizedValueSearch ? 0 : Math.max(0, filteredValues.length - showCount)
  );

  let countLabel = $derived(values.length > 0 ? `(${values.length})` : '');

  let currentKey = $derived(
    store.selectedIndex
      ? `${store.selectedIndex}|${store.query}|${serializeTimeRange(store.timeRange)}`
      : null
  );

  $effect(() => {
    if (!open || !currentKey) return;
    if (currentKey === loadedKey) return;

    abortCtl?.abort();
    const ctl = new AbortController();
    abortCtl = ctl;
    const requestedKey = currentKey;
    const indexId = store.selectedIndex;
    if (!indexId) return;

    valuesLoading = true;
    valuesError = null;

    fetchValues({
      indexId,
      field: field.name,
      query: store.query,
      timeRange: store.timeRange,
      signal: ctl.signal,
    })
      .then((result) => {
        if (ctl.signal.aborted) return;
        values = result;
        loadedKey = requestedKey;
        valuesLoading = false;
      })
      .catch((err: unknown) => {
        if (ctl.signal.aborted) return;
        valuesError = err instanceof Error ? err.message : 'Failed to load values';
        values = [];
        valuesLoading = false;
      });

    return () => {
      if (abortCtl === ctl) abortCtl = null;
      ctl.abort();
    };
  });

  function toggle() {
    open = !open;
    if (!open) {
      valueSearch = '';
      showCount = FIELD_VALUES_INITIAL_SHOW;
      abortCtl?.abort();
      abortCtl = null;
      values = [];
      loadedKey = null;
      valuesLoading = false;
      valuesError = null;
    }
  }

  function showMore() {
    showCount = FIELD_VALUES_LIMIT;
  }

  function showLess() {
    showCount = FIELD_VALUES_INITIAL_SHOW;
  }
</script>

<div class="border-b border-base-content/10">
  <button
    type="button"
    class="flex w-full items-center gap-1 py-1.5 {indented ? 'pr-3 pl-6' : 'px-3'}"
    aria-expanded={open}
    onclick={toggle}
  >
    {#if open}
      <ChevronDown class="h-3 w-3 shrink-0 text-base-content/60" />
    {:else}
      <ChevronRight class="h-3 w-3 shrink-0 text-base-content/60" />
    {/if}
    <span class="min-w-0 flex-1 truncate text-left text-xs" title={field.name}>
      {field.displayName}
    </span>
    {#if countLabel}
      <span class="text-[10px] text-base-content/40">{countLabel}</span>
    {/if}
  </button>

  {#if open}
    <div class="pb-3 {indented ? 'pr-3 pl-6' : 'px-3'}">
      {#if valuesLoading}
        <div class="flex items-center gap-2 py-1 font-mono text-xs text-base-content/50">
          <span class="loading loading-spinner loading-xs"></span>
          Loading…
        </div>
      {:else if valuesError}
        <p class="py-1 font-mono text-xs text-error">{valuesError}</p>
      {:else}
        {#if values.length > FIELD_VALUES_INITIAL_SHOW}
          <input
            type="text"
            class="input input-xs mb-2 w-full"
            placeholder="Search values…"
            aria-label="Filter values"
            bind:value={valueSearch}
          />
        {/if}

        {#if visibleValues.length === 0}
          <p class="py-1 text-xs text-base-content/50">
            {normalizedValueSearch ? 'No matching values' : 'No values found'}
          </p>
        {:else}
          <ul class="flex flex-col gap-0.5">
            {#each visibleValues as bucket (bucket.value)}
              <li class="flex items-center gap-2 px-1.5 font-mono text-xs">
                <span class="min-w-0 flex-1 truncate">{bucket.value}</span>
                <span
                  class="w-12 shrink-0 text-right text-[10px] text-base-content/50 tabular-nums"
                >
                  {bucket.count.toLocaleString()}
                </span>
              </li>
            {/each}
          </ul>

          {#if !normalizedValueSearch && remaining > 0}
            <button
              type="button"
              class="mt-1 text-xs text-primary hover:underline"
              onclick={showMore}
            >
              Show more ({remaining})
            </button>
          {:else if !normalizedValueSearch && showCount > FIELD_VALUES_INITIAL_SHOW && values.length > FIELD_VALUES_INITIAL_SHOW}
            <button
              type="button"
              class="mt-1 text-xs text-primary hover:underline"
              onclick={showLess}
            >
              Show less
            </button>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
</div>
